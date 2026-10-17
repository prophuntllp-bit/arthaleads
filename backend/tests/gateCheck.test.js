// TEMPORARY (17 Oct 2026): fails on purpose to prove Railway's "Wait for CI"
// blocks a release whose tests fail. Removed by the next commit.
console.log("  FAIL  deliberate failure: the deploy gate must stop this commit");
process.exit(1);
