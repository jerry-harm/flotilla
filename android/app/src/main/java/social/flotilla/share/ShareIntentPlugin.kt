package social.flotilla.share

import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.core.content.IntentCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "ShareIntent")
class ShareIntentPlugin : Plugin() {
  // Capacitor runs the launch intent through here as well as intents delivered while the app is
  // already running, so this is the only hook we need. Retaining the event covers a cold start,
  // where the web view isn't listening yet.
  override fun handleOnNewIntent(intent: Intent) {
    if (intent.action == Intent.ACTION_SEND) {
      val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
      val text = intent.getStringExtra(Intent.EXTRA_TEXT)

      // Android hands the same intent back when the activity is recreated, so drop the payload
      // once we've taken it to avoid re-opening the share dialog.
      if (uri != null) {
        intent.removeExtra(Intent.EXTRA_STREAM)

        // Copying a shared video can take a while, and this runs on the main thread
        bridge.execute { notifyListeners("shareReceived", copyToCache(uri), true) }
      } else if (text != null) {
        intent.removeExtra(Intent.EXTRA_TEXT)
        notifyListeners("shareReceived", JSObject().put("text", text), true)
      }
    }
  }

  // A content uri is readable by us but meaningless to the web view, so hand over a copy that
  // capacitor's file server can serve.
  private fun copyToCache(uri: Uri): JSObject {
    val resolver = context.contentResolver
    val type = resolver.getType(uri)
    val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(type)
    val file = File.createTempFile("shared", extension?.let { ".$it" }, context.cacheDir)

    resolver.openInputStream(uri)?.use { input ->
      file.outputStream().use { output -> input.copyTo(output) }
    }

    return JSObject()
      .put("path", file.absolutePath)
      .put("name", file.name)
      .put("type", type)
  }
}
