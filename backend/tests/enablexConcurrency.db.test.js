// Concurrent EnableX call events on the same lead must all land. Each event used
// to load the lead, edit activities[i].meta and lead.save(); when two events for
// one call overlapped, the second failed with VersionError and its change was
// lost (live, 15 Oct 2026). Writes now go through services/callActivityStore.js
// as atomic updates; EnableX, file storage and push are stubbed here.
delete process.env.OPENAI_API_KEY; // no transcription in this test
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["leads", "projectleads", "organizations"]) await mongoose.connection.createCollection(c).catch(() => {});

  // EnableX API: slow enough that events genuinely overlap.
  const axios = require("axios");
  const calls = { recordingStart: 0, download: 0, hangup: 0 };
  axios.put = async (url) => { await sleep(30); if (/\/recording$/.test(url)) calls.recordingStart++; return { data: {} }; };
  axios.get = async () => { await sleep(30); calls.download++; return { data: Buffer.from("RIFF") }; };
  axios.delete = async () => { calls.hangup++; return { data: {} }; };
  let uploads = 0;
  require("../utils/upload").uploadCallRecording = async () => { await sleep(20); uploads++; return `https://files.example.com/rec-${uploads}.wav`; };

  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.join(" ")); };
  console.info = () => {};

  const { processCallStateEvent } = require("../routes/enablexRoutes")._callEvents;
  const { updateCallActivity, pushActivity, activityMatch } = require("../services/callActivityStore");
  const Lead = require("../models/Lead"), ProjectLead = require("../models/ProjectLead");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nEnableX concurrent call events\n");

  const orgId = oid();
  await mongoose.connection.collection("organizations").insertOne({ _id: orgId, name: "Test org", enablex: { enabled: true, appId: "app", apiKey: "key" } });

  const makeLead = async (Model, prefix, extra = {}) => {
    const _id = oid();
    const ownerRef = `${prefix}_${_id}_1760500000000`;
    await Model.collection.insertOne({
      _id, orgId, name: "Rahul Verma", phone: "9876543210", status: "New", firstContactedAt: null, __v: 0,
      activities: [{ _id: oid(), type: "called", description: "Call to Rahul Verma", meta: { ownerRef, voiceId: `v-${_id}`, direction: "outbound", status: "initiated" }, createdAt: new Date() }],
      ...(Model === ProjectLead ? { project: oid(), importedBy: oid() } : {}),
      ...extra,
    });
    return { _id, ownerRef, voiceId: `v-${_id}` };
  };

  // 1. Two direct updates of the same activity at once both land.
  {
    const { _id } = await makeLead(Lead, "lead");
    const act = (await Lead.findById(_id).lean()).activities[0];
    await Promise.all([
      updateCallActivity(Lead, _id, activityMatch(act), { set: { "meta.recordingStartRequested": true } }),
      updateCallActivity(Lead, _id, activityMatch(act), { set: { "meta.recordingSaveRequested": true } }),
      ...Array.from({ length: 20 }, (_, i) => updateCallActivity(Lead, _id, activityMatch(act), { set: { [`meta.f${i}`]: i } })),
    ]);
    const m = (await Lead.findById(_id).lean()).activities[0].meta;
    check(m.recordingStartRequested === true && m.recordingSaveRequested === true, "two concurrent updates of one activity both land", JSON.stringify(m));
    check(Array.from({ length: 20 }, (_, i) => m[`f${i}`] === i).every(Boolean) && m.status === "initiated" && m.ownerRef, "20 more concurrent field updates all land and nothing else is lost");

    // A claim (where) is won by exactly one of several racers.
    const wins = await Promise.all(Array.from({ length: 5 }, (_, i) => updateCallActivity(Lead, _id, activityMatch(act), {
      set: { "meta.status": "answered", "meta.duration": i }, where: { "meta.status": "initiated" },
    })));
    check(wins.filter(Boolean).length === 1, "a conditional write is won by exactly one of 5 racers", JSON.stringify(wins));

    // A stale load-edit-save of the array elsewhere now fails instead of
    // silently overwriting fields written atomically.
    const stale = await Lead.findById(_id);
    await updateCallActivity(Lead, _id, activityMatch(act), { set: { "meta.recordingUrl": "https://x/1.wav" } });
    stale.activities[0].meta = { ...stale.activities[0].meta, notes: "old copy" };
    stale.markModified("activities");
    let threw = null;
    try { await stale.save(); } catch (e) { threw = e.name; }
    const after = (await Lead.findById(_id).lean()).activities[0].meta;
    check(threw === "VersionError" && after.recordingUrl === "https://x/1.wav", "a stale whole-array save is rejected, the atomic write survives", `${threw} ${after.recordingUrl}`);
  }

  // 2. A real call's events arriving together: both legs connect, then
  //    disconnected and recording_complete (both carrying the recording URL).
  for (const [Model, prefix, label] of [[Lead, "lead", "lead"], [ProjectLead, "projectlead", "project lead"]]) {
    calls.recordingStart = 0; uploads = 0; calls.hangup = 0; errors.length = 0;
    const { _id, ownerRef, voiceId } = await makeLead(Model, prefix);
    await Promise.all([
      processCallStateEvent(String(orgId), { state: "connected", voice_id: voiceId, custom_data: ownerRef }, "[enablex webhook]"),
      processCallStateEvent(String(orgId), { state: "connected", voice_id: voiceId }, "[enablex webhook]"),
      processCallStateEvent(String(orgId), { state: "disconnected", voice_id: voiceId, custom_data: ownerRef, call_duration: 42, recording_url: "https://portal.enablex.io/rec/1" }, "[enablex webhook]"),
      processCallStateEvent(String(orgId), { state: "recording_complete", voice_id: voiceId, recording_duration: 40, recording_url: "https://portal.enablex.io/rec/1" }, "[enablex webhook]"),
    ]);
    for (let i = 0; i < 50; i++) {
      if ((await Model.findById(_id).lean()).activities[0].meta.recordingUrl) break;
      await sleep(20);
    }
    const doc = await Model.findById(_id).lean();
    const m = doc.activities[0].meta;
    const versionErrors = errors.filter((e) => /VersionError|No matching document/.test(e));
    check(!versionErrors.length && !errors.some((e) => /\[enablex webhook\] error/.test(e)), `${label}: no write errors`, errors.join(" | "));
    check(m.recordingStartRequested === true && calls.recordingStart === 1, `${label}: recording started once though both legs connected`, `${m.recordingStartRequested} x${calls.recordingStart}`);
    check(m.status === "answered" && [40, 42].includes(m.duration) && doc.activities[0].description.startsWith("Call with Rahul Verma"), `${label}: call finalized as answered with its duration`, JSON.stringify({ s: m.status, d: m.duration, t: doc.activities[0].description }));
    check(m.recordingSaveRequested === true && /^https:\/\/files\.example\.com\//.test(m.recordingUrl || "") && uploads === 1, `${label}: recording saved once`, `${m.recordingUrl} x${uploads}`);
    check(doc.status === "Contacted" && doc.firstContactedAt && doc.activities.filter((a) => a.type === "status_changed").length === 1, `${label}: moved to Contacted once`, `${doc.status} ${doc.activities.length}`);
    check(calls.hangup === 1, `${label}: agent leg hung up once`, `x${calls.hangup}`);
    check(m.ownerRef === ownerRef && m.voiceId === voiceId && m.direction === "outbound", `${label}: original call fields kept`);
  }

  // 3. A new inbound call is logged while the previous call is being finalized.
  {
    const { _id, ownerRef, voiceId } = await makeLead(Lead, "lead");
    await Promise.all([
      processCallStateEvent(String(orgId), { state: "disconnected", voice_id: voiceId, custom_data: ownerRef, call_duration: 3 }, "[enablex webhook]"),
      pushActivity(Lead, _id, { type: "called", description: "Inbound call from Rahul Verma", meta: { direction: "inbound", status: "initiated", ownerRef: `lead_${_id}_2` } }),
    ]);
    const doc = await Lead.findById(_id).lean();
    check(doc.activities.length === 2 && doc.activities[0].meta.status === "missed" && doc.activities[1].meta.status === "initiated", "an inbound call logged mid-finalize keeps both changes", JSON.stringify(doc.activities.map((a) => a.meta.status)));
    check(doc.activities[1]._id && doc.activities[1].createdAt, "a pushed activity gets its _id and timestamps");
  }

  // 4. Both legs' stream-diagnostic tracks finishing together are both kept,
  //    and a leg's track is replaced, not duplicated, when it is saved again.
  {
    const { _saveDiagnosticResult } = require("../services/callStreamRecorder");
    const { ownerRef } = await makeLead(ProjectLead, "projectlead");
    const state = (voiceId) => ({ orgId, ownerRef, voiceId });
    await Promise.all([
      _saveDiagnosticResult(state("legA"), { voiceId: "legA", bytes: 1 }),
      _saveDiagnosticResult(state("legB"), { voiceId: "legB", bytes: 2 }),
    ]);
    await _saveDiagnosticResult(state("legA"), { voiceId: "legA", bytes: 3 });
    const d = (await ProjectLead.findOne({ "activities.meta.ownerRef": ownerRef }).lean()).activities[0].meta.recordingDiagnostics;
    const tracks = (d?.tracks || []).map((t) => `${t.voiceId}:${t.bytes}`).sort().join(",");
    check(tracks === "legA:3,legB:2" && d.status === "captured", "both legs' diagnostic tracks are kept; a re-save replaces its own", tracks);
  }

  console.error = origError;
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all EnableX concurrency checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
