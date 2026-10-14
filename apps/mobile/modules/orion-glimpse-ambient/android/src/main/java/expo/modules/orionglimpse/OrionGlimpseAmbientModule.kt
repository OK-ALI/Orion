package expo.modules.orionglimpse

import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.PixelCopy
import android.view.WindowManager
import com.facebook.react.uimanager.util.ReactFindViewUtil
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Captures ONLY an identified visible Glimpse surface; only two colors leave native memory. */
class OrionGlimpseAmbientModule : Module() {
  private var owner: String? = null
  private var generation = 0L
  private var busy = false
  private val handler = Handler(Looper.getMainLooper())
  override fun definition() = ModuleDefinition {
    Name("OrionGlimpseAmbient")
    AsyncFunction("sample") { nativeId: String, session: String, promise: Promise ->
      sample(nativeId, session, promise)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { session: String ->
      if (owner == session) { owner = null; generation++ }
    }.runOnQueue(Queues.MAIN)
    OnActivityEntersBackground { owner = null; generation++ }
    OnDestroy { owner = null; generation++ }
  }
  private fun sample(nativeId: String, session: String, promise: Promise) {
    val activity = appContext.currentActivity
    if (Build.VERSION.SDK_INT < 26 || busy || activity == null || !activity.hasWindowFocus()
      || session.length !in 1..100 || nativeId != "orion-glimpse:" + session
      || activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0) {
      promise.resolve(null); return
    }
    val view = ReactFindViewUtil.findView(activity.window.decorView, nativeId)
    val visible = Rect()
    if (view == null || !view.isShown || !view.isAttachedToWindow || view.width < 1 || view.height < 1
      || !view.getGlobalVisibleRect(visible) || visible.width() < view.width || visible.height() < view.height) {
      promise.resolve(null); return
    }
    val point = IntArray(2); view.getLocationInWindow(point)
    val crop = Rect(point[0], point[1], point[0] + view.width, point[1] + view.height)
    if (owner != session) { owner = session; generation++ }
    val requestGeneration = generation
    val bitmap = Bitmap.createBitmap(32, 18, Bitmap.Config.ARGB_8888)
    val started = SystemClock.elapsedRealtime()
    busy = true
    var completed = false
    val timeout = Runnable { if (!completed) { completed = true; promise.resolve(null) } }
    handler.postDelayed(timeout, 1500)
    try {
      PixelCopy.request(activity.window, crop, bitmap, { result ->
        handler.removeCallbacks(timeout); busy = false
        try {
          if (!completed) {
            completed = true
            if (result != PixelCopy.SUCCESS || generation != requestGeneration || owner != session || !activity.hasWindowFocus() || !view.isAttachedToWindow) promise.resolve(null)
            else {
              val pixels = IntArray(32 * 18); bitmap.getPixels(pixels, 0, 32, 0, 0, 32, 18)
              val colors = GlimpsePalette.colors(pixels)
              promise.resolve(if (colors == null) null else mapOf("colors" to colors, "session" to session, "durationMs" to (SystemClock.elapsedRealtime() - started)))
            }
          }
        } finally { bitmap.recycle() }
      }, handler)
    } catch (_: Exception) {
      handler.removeCallbacks(timeout); busy = false; bitmap.recycle()
      if (!completed) { completed = true; promise.resolve(null) }
    }
  }
}
