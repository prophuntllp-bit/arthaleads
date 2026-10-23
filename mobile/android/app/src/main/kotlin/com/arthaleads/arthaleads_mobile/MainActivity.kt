package com.arthaleads.arthaleads_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    // Exports (Excel, CSV) go to Downloads/ArthaLeads like any download and
    // open in the phone's spreadsheet app (lib/core/file_output.dart).
    // MediaStore needs no storage permission on Android 10+; older phones
    // keep the file in the app's own folder (handled on the Dart side).
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "arthaleads/downloads").setMethodCallHandler { call, result ->
            when (call.method) {
                "save" -> {
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                        result.success(null)
                        return@setMethodCallHandler
                    }
                    try {
                        val bytes = call.argument<ByteArray>("bytes")!!
                        val values = ContentValues().apply {
                            put(MediaStore.MediaColumns.DISPLAY_NAME, call.argument<String>("name")!!)
                            put(MediaStore.MediaColumns.MIME_TYPE, call.argument<String>("mime")!!)
                            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ArthaLeads")
                            put(MediaStore.MediaColumns.IS_PENDING, 1)
                        }
                        val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                            ?: throw IllegalStateException("Downloads unavailable")
                        contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
                        values.clear()
                        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                        contentResolver.update(uri, values, null, null)
                        notifyDownloaded(uri, call.argument<String>("name")!!, call.argument<String>("mime")!!)
                        result.success(uri.toString())
                    } catch (e: Exception) {
                        result.error("save_failed", e.message, null)
                    }
                }
                "open" -> {
                    val intent = Intent(Intent.ACTION_VIEW)
                        .setDataAndType(Uri.parse(call.argument<String>("uri")!!), call.argument<String>("mime")!!)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    try {
                        startActivity(intent)
                        result.success(true)
                    } catch (e: ActivityNotFoundException) {
                        result.success(false)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    // The "Download complete" notification a browser download shows: the file
    // name, and a tap opens it in the app for its type (Excel, CSV, PDF).
    private fun notifyDownloaded(uri: Uri, name: String, mime: String) {
        try {
            val manager = getSystemService(NotificationManager::class.java) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    NotificationChannel("downloads", "Downloads", NotificationManager.IMPORTANCE_DEFAULT).apply {
                        description = "Files you export from ArthaLeads"
                        setSound(null, null)
                    }
                )
            }
            val open = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            val tap = PendingIntent.getActivity(
                this, uri.hashCode(), Intent.createChooser(open, name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            val icon = resources.getIdentifier("ic_notification", "drawable", packageName)
                .takeIf { it != 0 } ?: android.R.drawable.stat_sys_download_done
            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, "downloads")
            else @Suppress("DEPRECATION") Notification.Builder(this)
            manager.notify(
                uri.hashCode(),
                builder.setSmallIcon(icon)
                    .setContentTitle(name)
                    .setContentText("Download complete · Saved in Downloads/ArthaLeads")
                    .setContentIntent(tap)
                    .setAutoCancel(true)
                    .build()
            )
        } catch (_: Exception) {
            // A missing notification never fails the download.
        }
    }
}
