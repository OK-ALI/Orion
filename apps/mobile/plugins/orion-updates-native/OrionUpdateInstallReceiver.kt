package com.okali.orion.updates

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import androidx.core.content.FileProvider
import java.io.File

class OrionUpdateInstallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val prefs = context.getSharedPreferences("orion-update-transaction-v2", 0)
    when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        prefs.edit().putString("phase", "awaiting-confirmation").putLong("updatedAt", System.currentTimeMillis()).apply()
        val confirmation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }
        confirmation?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (confirmation != null) context.startActivity(confirmation)
      }
      PackageInstaller.STATUS_SUCCESS -> {
        prefs.edit().putString("phase", "installed").putLong("updatedAt", System.currentTimeMillis()).apply()
      }
      else -> {
        val apk = File(context.cacheDir, "orion-updates/orion-update.apk")
        if (apk.isFile && !prefs.getBoolean("oemFallbackAttempted", false)) {
          prefs.edit().putBoolean("oemFallbackAttempted", true).putString("phase", "awaiting-confirmation").putLong("updatedAt", System.currentTimeMillis()).apply()
          val uri = FileProvider.getUriForFile(context, "${context.packageName}.orion-updates", apk)
          context.startActivity(Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
          })
        } else {
          prefs.edit()
            .putString("phase", "failed")
            .putString("message", "Orion couldn't finish the update. Try again.")
            .putLong("updatedAt", System.currentTimeMillis())
            .apply()
        }
      }
    }
  }
}
