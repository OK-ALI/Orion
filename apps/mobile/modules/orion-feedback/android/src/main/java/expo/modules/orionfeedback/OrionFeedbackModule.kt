package expo.modules.orionfeedback
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.max

class OrionFeedbackModule : Module() {
  private var pending: Promise? = null
  private val executor = Executors.newSingleThreadExecutor()
  private fun context() = appContext.reactContext ?: throw IllegalStateException("FEEDBACK_CONTEXT_UNAVAILABLE")
  private fun screenshotFile() = File(context().filesDir, "orion-feedback/draft.jpg")
  override fun definition() = ModuleDefinition {
    Name("OrionFeedback")
    AsyncFunction("uuid") { UUID.randomUUID().toString() }
    AsyncFunction("environment") {
      val ctx = context()
      @Suppress("DEPRECATION") val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
      @Suppress("DEPRECATION") val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
      mapOf("versionCode" to code.toDouble(), "device" to (Build.MANUFACTURER + " " + Build.MODEL).replace(Regex("[^a-zA-Z0-9 ._()-]"), "").take(80), "android" to Build.VERSION.RELEASE.take(20))
    }
    AsyncFunction("copy") { value: String ->
      if (!value.matches(Regex("ORN-FB-[A-F0-9]{24}"))) throw IllegalArgumentException("INVALID_FEEDBACK_ID")
      (context().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Orion Feedback ID", value))
    }
    AsyncFunction("removeScreenshot") { screenshotFile().delete(); Unit }
    AsyncFunction("screenshot") {
      val file = screenshotFile()
      if (file.exists() && file.length() <= 720000) Base64.encodeToString(file.readBytes(), Base64.NO_WRAP) else null
    }
    AsyncFunction("pickScreenshot") { promise: Promise ->
      if (pending != null) promise.reject("PICKER_BUSY", "A screenshot is already being selected", null)
      else {
        val activity = appContext.currentActivity
        if (activity == null) promise.reject("PICKER_UNAVAILABLE", "Screenshot selection is unavailable", null)
        else {
          pending = promise
          try { activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply { type = "image/*"; addCategory(Intent.CATEGORY_OPENABLE); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }, 47441) }
          catch (_: Exception) { pending = null; promise.reject("PICKER_UNAVAILABLE", "Screenshot selection is unavailable", null) }
        }
      }
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)
    OnActivityResult { _, payload ->
      if (payload.requestCode == 47441) {
        val promise = pending; pending = null
        if (payload.resultCode != Activity.RESULT_OK || payload.data?.data == null) promise?.resolve(null)
        else {
          val uri = payload.data!!.data!!
          executor.execute { try { promise?.resolve(prepareScreenshot(uri)) } catch (_: Exception) { promise?.reject("IMAGE_UNAVAILABLE", "Choose a smaller image and try again", null) } }
        }
      }
    }
    OnDestroy { pending?.reject("PICKER_CLOSED", "Screenshot selection closed", null); pending = null; executor.shutdown() }
  }
  private fun prepareScreenshot(uri: Uri): Map<String, String> {
    val resolver = context().contentResolver
    val bytes = resolver.openInputStream(uri)?.use { stream ->
      val out = ByteArrayOutputStream(); val buffer = ByteArray(8192)
      while (true) { val count = stream.read(buffer); if (count < 0) break; if (out.size() + count > 20000000) throw IllegalArgumentException("IMAGE_LIMIT"); out.write(buffer, 0, count) }; out.toByteArray()
    } ?: throw IllegalArgumentException("IMAGE_UNAVAILABLE")
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth < 1 || bounds.outHeight < 1 || max(bounds.outWidth, bounds.outHeight) > 30000) throw IllegalArgumentException("INVALID_IMAGE")
    var sample = 1; while (max(bounds.outWidth, bounds.outHeight) / sample > 1280) sample *= 2
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: throw IllegalArgumentException("INVALID_IMAGE")
    val output = ByteArrayOutputStream()
    try { var quality = 85; do { output.reset(); bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output); quality -= 15 } while (output.size() > 720000 && quality >= 25) } finally { bitmap.recycle() }
    if (output.size() > 720000) throw IllegalArgumentException("IMAGE_LIMIT")
    val file = screenshotFile(); file.parentFile?.mkdirs(); val temp = File(file.parentFile, "draft.tmp"); temp.writeBytes(output.toByteArray())
    if (!temp.renameTo(file)) { temp.delete(); throw IllegalStateException("IMAGE_SAVE_FAILED") }
    // Re-encoding removes original location/EXIF metadata. One private bounded file.
    return mapOf("uri" to Uri.fromFile(file).toString())
  }
}
