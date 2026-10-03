package com.okali.orion.playback

import android.os.Build
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Player-scoped immersive ownership. Every exit path restores normal bars. */
class OrionPlayerSystemUiModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var owned = false
  private var previousCutoutMode: Int? = null
  private var ownedDecor: View? = null
  private val layoutListener = View.OnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
    if (owned && (left != oldLeft || top != oldTop || right != oldRight || bottom != oldBottom)) {
      withWindow { if (owned) hideBars(it) }
    }
  }
  private val focusListener = android.view.ViewTreeObserver.OnWindowFocusChangeListener { focused ->
    if (focused && owned) withWindow { window -> window.decorView.post { if (owned) hideBars(window) } }
  }

  override fun getName(): String = "OrionPlayerSystemUi"

  private fun withWindow(action: (android.view.Window) -> Unit) {
    val activity = context.currentActivity ?: return
    activity.runOnUiThread { activity.window?.let(action) }
  }

  @ReactMethod
  fun enter() = withWindow { window ->
    if (!owned) {
      owned = true
      ownedDecor = window.decorView
      window.decorView.addOnLayoutChangeListener(layoutListener)
      window.decorView.viewTreeObserver.addOnWindowFocusChangeListener(focusListener)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        previousCutoutMode = window.attributes.layoutInDisplayCutoutMode
        window.attributes = window.attributes.apply {
          layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
      }
    }
    hideBars(window)
  }

  @ReactMethod
  fun hide() = withWindow { if (owned) hideBars(it) }

  @ReactMethod
  fun show() = withWindow { window ->
    if (!owned) return@withWindow
    WindowCompat.getInsetsController(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
  }

  @ReactMethod
  fun exit() = withWindow { window ->
    if (!owned) return@withWindow
    ownedDecor?.removeOnLayoutChangeListener(layoutListener)
    ownedDecor?.viewTreeObserver?.takeIf { it.isAlive }?.removeOnWindowFocusChangeListener(focusListener)
    ownedDecor = null
    owned = false
    WindowCompat.getInsetsController(window, window.decorView).apply {
      show(WindowInsetsCompat.Type.systemBars())
      systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
    }
    WindowCompat.setDecorFitsSystemWindows(window, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      previousCutoutMode?.let { prior ->
        window.attributes = window.attributes.apply { layoutInDisplayCutoutMode = prior }
      }
    }
    @Suppress("DEPRECATION")
    run { window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE }
    previousCutoutMode = null
  }

  private fun hideBars(window: android.view.Window) {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowCompat.getInsetsController(window, window.decorView).apply {
      systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      hide(WindowInsetsCompat.Type.systemBars())
    }
  }
}
