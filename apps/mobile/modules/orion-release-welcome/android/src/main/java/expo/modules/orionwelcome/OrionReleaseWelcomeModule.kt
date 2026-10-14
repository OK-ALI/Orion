package expo.modules.orionwelcome
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
class OrionReleaseWelcomeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OrionReleaseWelcome")
    AsyncFunction("installation") {
      val context = appContext.reactContext ?: throw IllegalStateException("WELCOME_CONTEXT_UNAVAILABLE")
      @Suppress("DEPRECATION") val info = context.packageManager.getPackageInfo(context.packageName, 0)
      mapOf("version" to (info.versionName ?: ""), "firstInstallTime" to info.firstInstallTime.toDouble(), "lastUpdateTime" to info.lastUpdateTime.toDouble())
    }
  }
}
