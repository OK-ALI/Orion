package com.okali.orion.playback

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

internal data class OrionOfflinePlayerPart(
  val fragmentIndex: Int,
  val file: File,
)

internal data class OrionOfflinePlayerSubtitle(
  val id: String,
  val language: String,
  val label: String,
  val format: String,
  val isDefault: Boolean,
  val file: File? = null,
  val document: OrionOfflinePlayerDocument? = null,
)

internal data class OrionOfflinePlayerDocument(
  val uri: Uri,
  val sizeBytes: Long,
)

internal data class OrionOfflinePlayerAsset(
  val assetId: String,
  val sourceKind: String,
  val fragmentCount: Int,
  val videoParts: List<OrionOfflinePlayerPart>,
  val audioParts: List<OrionOfflinePlayerPart>,
  val videoMediaCount: Int,
  val audioMediaCount: Int,
  val subtitles: List<OrionOfflinePlayerSubtitle>,
  val mediaFile: File? = null,
  val mediaDocument: OrionOfflinePlayerDocument? = null,
)

internal data class OrionOfflinePlayerResolution(
  val asset: OrionOfflinePlayerAsset? = null,
  val stage: String,
  val code: String? = null,
  val message: String? = null,
  val failedFragmentIndex: Int? = null,
)

internal data class OrionOfflinePlaybackRoute(
  val assetId: String? = null,
  val sourceKind: String? = null,
  val fragmentCount: Int = 0,
  val code: String? = null,
  val message: String? = null,
)

internal enum class OrionArtifactReconciliationPurpose {
  ACCESS,
  PERIODIC,
  EXPLICIT_DEEP,
}

internal object OrionArtifactIntegrityPolicy {
  const val FULL_DIGEST_RECHECK_INTERVAL_MS = 24L * 60L * 60L * 1000L

  fun previousIntegrityCheckedAt(integrityCheckedAt: Long, legacyLastCheckedAt: Long): Long? =
    integrityCheckedAt.takeIf { it > 0L } ?: legacyLastCheckedAt.takeIf { it > 0L }

  fun requiresDigestVerification(
    purpose: OrionArtifactReconciliationPurpose,
    stampValid: Boolean,
    integrityCheckedAt: Long,
    legacyLastCheckedAt: Long,
    now: Long,
  ): Boolean {
    if (!stampValid || purpose == OrionArtifactReconciliationPurpose.EXPLICIT_DEEP) return true
    // Playback and exact management actions must stay bounded. A valid durable
    // stamp is paired with fresh URI/size/descriptor checks on these hot paths;
    // full-file hashing belongs to settlement or background integrity work.
    if (purpose == OrionArtifactReconciliationPurpose.ACCESS) return false
    val baseline = previousIntegrityCheckedAt(integrityCheckedAt, legacyLastCheckedAt) ?: return true
    if (now <= 0L || now < baseline) return true
    return now - baseline >= FULL_DIGEST_RECHECK_INTERVAL_MS
  }
}

/** Bounded native owner for reconciliation and ID-only download management. */
internal object OrionDownloadArtifactManager {
  private val reconciliationLock = Any()
  @Volatile private var reconciling = false
  private const val MAX_FRAGMENT_INDEX_BYTES = 2L * 1024L * 1024L
  private const val MAX_FRAGMENT_COUNT = 20_000
  private const val MAX_FINALIZED_SUBTITLES = 2
  private const val MAX_FINALIZED_SUBTITLE_BYTES = 10L * 1024L * 1024L
  private const val MAX_FINALIZED_SUBTITLE_CHARS = 10 * 1024 * 1024
  private val FRAGMENT_ROLES = setOf("video", "video-init", "audio", "audio-init")

  private data class ArtifactProbe(
    val availability: OrionArtifactAvailability,
    val observedSizeBytes: Long?,
    val verificationVersion: Int? = null,
    val verifiedByteCount: Long? = null,
    val contentSha256: String? = null,
    val integrityCheckedAt: Long? = null,
    val clearVerification: Boolean = false,
  )

  fun reconcile(
    context: Context,
    assetIds: Set<String>? = null,
    purpose: OrionArtifactReconciliationPurpose = if (assetIds == null) {
      OrionArtifactReconciliationPurpose.PERIODIC
    } else {
      OrionArtifactReconciliationPurpose.ACCESS
    },
  ): JSONObject {
    synchronized(reconciliationLock) {
      if (reconciling) return OrionDownloadJobStore.snapshot()
      reconciling = true
    }
    return try {
      val assets = OrionDownloadJobStore.ownershipAssets(assetIds)
      val updates = JSONArray()
      val checkedAt = System.currentTimeMillis()
      for (assetIndex in 0 until assets.length()) {
        val asset = assets.optJSONObject(assetIndex) ?: continue
        val artifacts = asset.optJSONArray("_artifacts") ?: continue
        for (artifactIndex in 0 until artifacts.length()) {
          val artifact = artifacts.optJSONObject(artifactIndex) ?: continue
          val probe = probeArtifact(
            context = context,
            asset = asset,
            artifact = artifact,
            purpose = purpose,
            checkedAt = checkedAt,
          )
          val update = JSONObject()
            .put("artifactId", artifact.optString("artifactId"))
            .put("_locatorFingerprint", artifact.optJSONObject("_locator")?.toString() ?: "")
            .put("availability", probe.availability.wire)
            .put("observedSizeBytes", probe.observedSizeBytes ?: JSONObject.NULL)
            .put("lastCheckedAt", checkedAt)
          if (
            probe.verificationVersion != null &&
            probe.verifiedByteCount != null &&
            probe.contentSha256 != null
          ) {
            update
              .put("_verificationVersion", probe.verificationVersion)
              .put("_verifiedByteCount", probe.verifiedByteCount)
              .put("_contentSha256", probe.contentSha256)
          }
          probe.integrityCheckedAt?.takeIf { it > 0L }?.let {
            update.put("_integrityCheckedAt", it)
          }
          if (probe.clearVerification) update.put("_clearVerification", true)
          updates.put(update)
        }
      }
      OrionDownloadJobStore.updateArtifactStates(updates)
      OrionDownloadJobStore.snapshot()
    } finally {
      synchronized(reconciliationLock) { reconciling = false }
    }
  }

  /**
   * Classifies only the native playback owner. It intentionally performs no
   * storage I/O: the selected native surface revalidates the exact artifact
   * before opening it, so route selection must not duplicate that work.
   */
  fun classifyOfflinePlaybackRoute(assetId: String): OrionOfflinePlaybackRoute {
    val clean = assetId.trim()
    fun failure(code: String, message: String) =
      OrionOfflinePlaybackRoute(code = code, message = message)
    if (!clean.matches(Regex("^[A-Za-z0-9._:-]{1,140}$"))) {
      return failure("offline-asset-id-invalid", "Offline download identity is invalid.")
    }
    val asset = OrionDownloadJobStore.ownershipAssets(setOf(clean)).optJSONObject(0)
      ?: return failure("offline-asset-not-found", "Offline download was not found.")
    val storageMode = asset.optJSONObject("storageTarget")?.optString("mode").orEmpty()
    if (asset.optString("destination") != "orion-library" || storageMode !in setOf("orion-library", "user-folder")) {
      return failure("offline-asset-not-managed", "This download is not an Orion Library offline asset.")
    }
    val primary = ownedPrimary(asset)
      ?: return failure("offline-primary-missing", "Offline media is not tracked.")
    when (primary.optString("availability")) {
      "missing" -> return failure("offline-primary-missing", "The downloaded media file is missing from Orion Library.")
      "unavailable" -> return failure("offline-primary-unavailable", "The downloaded media file could not be verified or opened.")
      "verified" -> Unit
      else -> return failure("offline-primary-not-verified", "Offline media is not currently verified.")
    }

    val locatorKind = primary.optJSONObject("_locator")?.optString("kind").orEmpty()
    val container = asset.optString("container")
    val mimeType = asset.optString("mimeType")
    if (container == "mp4" && mimeType == "video/mp4" && locatorKind in setOf("content-uri", "managed", "managed-relative")) {
      return OrionOfflinePlaybackRoute(clean, "file", 1)
    }
    val fragmentKind = container.removeSuffix("-fragments").takeIf { it in setOf("hls", "dash") }
    if (fragmentKind != null && locatorKind in setOf("managed", "managed-relative")) {
      return OrionOfflinePlaybackRoute(clean, fragmentKind, 0)
    }
    return failure("offline-playback-route-invalid", "Orion could not classify this offline download.")
  }


  fun resolveOfflinePlayback(context: Context, assetId: String): JSONObject {
    val clean = assetId.trim()
    if (!clean.matches(Regex("^[A-Za-z0-9._:-]{1,140}$"))) {
      return playbackResult(false, clean, "offline-asset-id-invalid", "Offline download identity is invalid.")
    }

    reconcile(context, setOf(clean))
    val asset = OrionDownloadJobStore.ownershipAssets(setOf(clean)).optJSONObject(0)
      ?: return playbackResult(false, clean, "offline-asset-not-found", "Offline download was not found.")
    val storageMode = asset.optJSONObject("storageTarget")?.optString("mode").orEmpty()
    if (asset.optString("destination") != "orion-library" || storageMode !in setOf("orion-library", "user-folder")) {
      return playbackResult(false, clean, "offline-asset-not-managed", "This download is not an Orion Library offline asset.")
    }

    val primary = ownedPrimary(asset)
      ?: return playbackResult(false, clean, "offline-primary-missing", "Offline media is not tracked.")
    when (primary.optString("availability")) {
      "missing" -> return playbackResult(false, clean, "offline-primary-missing", "The downloaded media file is missing from Orion Library.")
      "unavailable" -> return playbackResult(false, clean, "offline-primary-unavailable", "The downloaded media file could not be verified or opened.")
      "verified" -> Unit
      else -> return playbackResult(false, clean, "offline-primary-not-verified", "Offline media is not currently verified.")
    }
    val locatorKind = primary.optJSONObject("_locator")?.optString("kind").orEmpty()
    if (locatorKind == "content-uri" && storageMode == "user-folder") {
      val expectedSize = primary.optLong("expectedSizeBytes", -1L)
      if (asset.optString("container") != "mp4" || asset.optString("mimeType") != "video/mp4" ||
        !OrionFinalizedArtifactPolicy.verificationStampMatches(
          primary.optInt("_verificationVersion", 0),
          primary.optLong("_verifiedByteCount", -1L),
          expectedSize,
          primary.optString("_contentSha256"),
        )
      ) {
        return playbackResult(false, clean, "offline-file-verification-required", "Offline media has not passed durable playback verification.")
      }
      val document = parseContentUri(primary.optJSONObject("_locator")?.optString("value").orEmpty())
        ?: return playbackResult(false, clean, "offline-primary-locator-invalid", "Offline media ownership could not be resolved.")
      val playbackUri = OrionFinalizedArtifactOwner.authorizeDocument(context, document, expectedSize)
        ?: return playbackResult(false, clean, "offline-file-uri-unavailable", "Orion could not open the selected media document for playback.")
      return JSONObject()
        .put("schemaVersion", 1)
        .put("ok", true)
        .put("assetId", clean)
        .put("uri", playbackUri.toString())
        .put("contentType", "progressive")
        .put("sourceKind", "file")
        .put("fragmentCount", 1)
        // User-folder subtitles stay behind the native asset-id boundary. The
        // dedicated Orion player resolves their exact owned document URIs.
        .put("subtitleCount", 0)
        .put("subtitles", JSONArray())
    }
    if (locatorKind !in setOf("managed", "managed-relative")) {
      return playbackResult(false, clean, "offline-primary-not-managed", "Offline media is not stored in Orion Library.")
    }
    val bundleDir = managedTarget(context, asset, primary)
      ?: return playbackResult(false, clean, "offline-primary-locator-invalid", "Offline media ownership could not be resolved.")

    if (bundleDir.isFile) {
      val expectedSize =
        primary.optLong(
          "expectedSizeBytes",
          -1L,
        )
      if (
        asset.optString("container") != "mp4" ||
        asset.optString("mimeType") != "video/mp4" ||
        !bundleDir.extension.equals("mp4", ignoreCase = true) ||
        expectedSize <= 0L ||
        bundleDir.length() != expectedSize
      ) {
        return playbackResult(false, clean, "offline-file-invalid", "Offline media file is missing or inconsistent.")
      }
      if (!OrionFinalizedArtifactPolicy.verificationStampMatches(
          primary.optInt("_verificationVersion", 0),
          primary.optLong("_verifiedByteCount", -1L),
          expectedSize,
          primary.optString("_contentSha256"),
        )) {
        return playbackResult(false, clean, "offline-file-verification-required", "Offline media has not passed durable playback verification.")
      }
      val subtitles = finalizedSubtitlePayload(context, asset)
        ?: return playbackResult(false, clean, "offline-subtitle-invalid", "Downloaded subtitles could not be opened safely.")
      val playbackUri = OrionFinalizedArtifactOwner.authorize(context, bundleDir, expectedSize)
        ?: return playbackResult(false, clean, "offline-file-uri-unavailable", "Orion could not authorize the local media file for playback.")
      return JSONObject()
        .put("schemaVersion", 1)
        .put("ok", true)
        .put("assetId", clean)
        .put("uri", playbackUri.toString())
        .put("contentType", "progressive")
        .put("sourceKind", "file")
        .put("fragmentCount", 1)
        .put("subtitleCount", subtitles.length())
        .put("subtitles", subtitles)
    }

    val validated = validateManagedFragmentBundle(bundleDir)
      ?: return playbackResult(false, clean, "offline-bundle-invalid", "Offline media fragments are missing or inconsistent.")

    val presentation = OrionDownloadPortableFinalizer.prepareOfflinePlaybackPresentation(
      context = context,
      assetId = clean,
      bundleDir = bundleDir,
      index = validated.index,
      tracks = asset.optJSONArray("tracks") ?: JSONArray(),
    )
    if (!presentation.ok || presentation.uri.isNullOrBlank()) {
      return playbackResult(
        false,
        clean,
        presentation.failureCode ?: "offline-presentation-unavailable",
        presentation.failureMessage ?: "Orion could not prepare this offline download for playback.",
      )
    }

    return JSONObject()
      .put("schemaVersion", 1)
      .put("ok", true)
      .put("assetId", clean)
      .put("uri", presentation.uri)
      .put("contentType", presentation.contentType ?: "hls")
      .put("sourceKind", presentation.sourceKind ?: validated.index.optString("kind"))
      .put("fragmentCount", validated.index.optInt("fragmentCount", 0))
      .put("subtitleCount", validated.index.optJSONArray("subtitles")?.length() ?: 0)
  }

  fun resolveFinalizedPlayerAsset(context: Context, assetId: String): OrionOfflinePlayerResolution {
    val resolution = resolveAnyOfflinePlayerAsset(context, assetId)
    val asset = resolution.asset ?: return resolution
    if (asset.mediaDocument == null && asset.mediaFile == null) {
      return OrionOfflinePlayerResolution(
        stage = "source-kind",
        code = "finalized-player-source-invalid",
        message = "This offline download is not finalized media.",
      )
    }
    return resolution
  }

  fun resolveOfflinePlayerAsset(context: Context, assetId: String): OrionOfflinePlayerResolution {
    val resolution = resolveAnyOfflinePlayerAsset(context, assetId)
    val asset = resolution.asset ?: return resolution
    if (asset.mediaDocument != null || asset.mediaFile != null) {
      return OrionOfflinePlayerResolution(
        stage = "source-kind",
        code = "offline-fragment-source-required",
        message = "This player accepts legacy fragment downloads only.",
      )
    }
    return resolution
  }

  private fun resolveAnyOfflinePlayerAsset(context: Context, assetId: String): OrionOfflinePlayerResolution {
    val clean = assetId.trim()
    fun failure(stage: String, code: String, message: String, index: Int? = null) =
      OrionOfflinePlayerResolution(stage = stage, code = code, message = message, failedFragmentIndex = index)

    if (!clean.matches(Regex("^[A-Za-z0-9._:-]{1,140}$"))) {
      return failure("asset-id", "offline-asset-id-invalid", "Offline download identity is invalid.")
    }
    reconcile(context, setOf(clean))
    val asset = OrionDownloadJobStore.ownershipAssets(setOf(clean)).optJSONObject(0)
      ?: return failure("asset-record", "offline-asset-not-found", "Offline download was not found.")
    val storageMode = asset.optJSONObject("storageTarget")?.optString("mode").orEmpty()
    if (asset.optString("destination") != "orion-library" || storageMode !in setOf("orion-library", "user-folder")) {
      return failure("destination", "offline-asset-not-managed", "This download is not an Orion Library offline asset.")
    }
    val primary = ownedPrimary(asset)
      ?: return failure("ownership", "offline-primary-missing", "Offline media is not tracked.")
    when (primary.optString("availability")) {
      "missing" -> return failure("availability", "offline-primary-missing", "The downloaded media file is missing from Orion Library.")
      "unavailable" -> return failure("availability", "offline-primary-unavailable", "The downloaded media file could not be verified or opened.")
      "verified" -> Unit
      else -> return failure("availability", "offline-primary-not-verified", "Offline media is not currently verified.")
    }
    val primaryLocatorKind = primary.optJSONObject("_locator")?.optString("kind").orEmpty()
    if (storageMode == "user-folder" && primaryLocatorKind == "content-uri") {
      val expectedSize = primary.optLong("expectedSizeBytes", -1L)
      if (asset.optString("container") != "mp4" || asset.optString("mimeType") != "video/mp4" ||
        !OrionFinalizedArtifactPolicy.verificationStampMatches(
          primary.optInt("_verificationVersion", 0),
          primary.optLong("_verifiedByteCount", -1L),
          expectedSize,
          primary.optString("_contentSha256"),
        )
      ) return failure("document-integrity", "offline-file-verification-required", "Offline media has not passed durable playback verification.")
      val documentUri = parseContentUri(primary.optJSONObject("_locator")?.optString("value").orEmpty())
        ?: return failure("document-locator", "offline-primary-locator-invalid", "Offline media ownership could not be resolved.")
      if (OrionFinalizedArtifactOwner.authorizeDocument(context, documentUri, expectedSize) == null) {
        return failure("document-authority", "offline-file-uri-unavailable", "Orion could not open the selected media document for playback.")
      }

      val artifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
      val trackMetadata = asset.optJSONArray("tracks") ?: JSONArray()
      val subtitles = mutableListOf<OrionOfflinePlayerSubtitle>()
      for (artifactIndex in 0 until artifacts.length()) {
        val artifact = artifacts.optJSONObject(artifactIndex) ?: continue
        if (artifact.optString("role") != "subtitle" || subtitles.size >= MAX_FINALIZED_SUBTITLES) continue
        // Optional subtitle loss remains visible to reconciliation/management,
        // but never invalidates a healthy verified video.
        if (artifact.optString("availability") != "verified") continue
        val trackId = artifact.optString("_trackId").takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,100}$")) } ?: continue
        val metadata = (0 until trackMetadata.length()).mapNotNull { trackMetadata.optJSONObject(it) }
          .firstOrNull { it.optString("kind") == "subtitle" && it.optString("id") == trackId } ?: continue
        val format = metadata.optString("format").lowercase().takeIf { it in setOf("vtt", "srt", "ass") } ?: continue
        val expectedSubtitleSize = artifact.optLong("expectedSizeBytes", -1L)
        if (expectedSubtitleSize <= 0L || expectedSubtitleSize > MAX_FINALIZED_SUBTITLE_BYTES) continue
        val locator = artifact.optJSONObject("_locator") ?: continue
        val subtitleFile: File?
        val subtitleDocument: OrionOfflinePlayerDocument?
        when (locator.optString("kind")) {
          "content-uri" -> {
            val uri = parseContentUri(locator.optString("value")) ?: continue
            val probe = OrionDownloadStorageRegistry.probeDocument(context, uri)
            if (probe !is OrionDownloadStorageRegistry.DocumentProbe.Verified || probe.sizeBytes != expectedSubtitleSize) continue
            subtitleFile = null
            subtitleDocument = OrionOfflinePlayerDocument(uri, expectedSubtitleSize)
          }
          "managed-relative" -> {
            val file = managedTarget(context, asset, artifact) ?: continue
            if (!file.isFile || file.length() != expectedSubtitleSize) continue
            subtitleFile = file
            subtitleDocument = null
          }
          else -> continue
        }
        val language = metadata.optString("language").replace(Regex("[^A-Za-z0-9-]"), "").take(12).ifBlank { "und" }
        val label = metadata.optString("label").replace(Regex("[\\u0000-\\u001f\\u007f]"), "").trim().take(120)
          .ifBlank { "${language.uppercase()} subtitle" }
        subtitles += OrionOfflinePlayerSubtitle(
          id = trackId,
          language = language,
          label = label,
          format = format,
          isDefault = metadata.optBoolean("default", subtitles.isEmpty()),
          file = subtitleFile,
          document = subtitleDocument,
        )
      }
      return OrionOfflinePlayerResolution(
        asset = OrionOfflinePlayerAsset(
          assetId = clean,
          sourceKind = "file",
          fragmentCount = 1,
          videoParts = emptyList(),
          audioParts = emptyList(),
          videoMediaCount = 1,
          audioMediaCount = 0,
          subtitles = subtitles,
          mediaDocument = OrionOfflinePlayerDocument(documentUri, expectedSize),
        ),
        stage = "ready",
      )
    }
    if (primaryLocatorKind !in setOf("managed", "managed-relative")) {
      return failure("locator", "offline-primary-not-managed", "Offline media is not stored in Orion Library.")
    }
    val bundleDir = managedTarget(context, asset, primary)
      ?: return failure("containment", "offline-primary-locator-invalid", "Offline media ownership could not be resolved.")

    if (bundleDir.isFile) {
      val expectedSize =
        primary.optLong(
          "expectedSizeBytes",
          -1L,
        )
      if (
        asset.optString("container") != "mp4" ||
        asset.optString("mimeType") != "video/mp4" ||
        !bundleDir.extension.equals("mp4", ignoreCase = true) ||
        expectedSize <= 0L ||
        bundleDir.length() != expectedSize
      ) {
        return failure("file-integrity", "offline-file-invalid", "Offline media file is missing or inconsistent.")
      }
      if (
        !OrionFinalizedArtifactPolicy.verificationStampMatches(
          primary.optInt("_verificationVersion", 0),
          primary.optLong("_verifiedByteCount", -1L),
          expectedSize,
          primary.optString("_contentSha256"),
        ) || OrionFinalizedArtifactOwner.authorize(context, bundleDir, expectedSize) == null
      ) {
        return failure("file-authority", "offline-file-authority-invalid", "Offline media could not be authorized for playback.")
      }

      val artifacts =
        asset.optJSONArray("_artifacts")
          ?: JSONArray()
      val trackMetadata =
        asset.optJSONArray("tracks")
          ?: JSONArray()
      val subtitleArtifacts =
        (0 until artifacts.length())
          .mapNotNull {
            artifacts.optJSONObject(it)
          }
          .filter {
            it.optString("role") == "subtitle"
          }

      if (subtitleArtifacts.size > 2) {
        return failure("subtitle-count", "offline-subtitle-count-invalid", "Downloaded subtitles could not be opened safely.")
      }

      val subtitles =
        mutableListOf<OrionOfflinePlayerSubtitle>()

      subtitleArtifacts.forEach { artifact ->
        val id =
          artifact.optString("_trackId")
            .takeIf {
              it.matches(
                Regex("^[A-Za-z0-9._:-]{1,100}$"),
              )
            }
            ?: return@forEach

        if (
          artifact.optString("availability") != "verified"
        ) {
          return@forEach
        }

        val file =
          managedTarget(
            context,
            asset,
            artifact,
          )
            ?: return@forEach

        val expectedSubtitleSize =
          artifact.optLong(
            "expectedSizeBytes",
            -1L,
          )

        if (
          !file.isFile ||
          expectedSubtitleSize <= 0L ||
          file.length() != expectedSubtitleSize
        ) {
          return@forEach
        }

        val metadata =
          (0 until trackMetadata.length())
            .mapNotNull {
              trackMetadata.optJSONObject(it)
            }
            .firstOrNull {
              it.optString("kind") == "subtitle" &&
              it.optString("id") == id
            }
            ?: return@forEach

        val format =
          metadata.optString("format")
            .lowercase()
            .takeIf {
              it in setOf(
                "vtt",
                "srt",
                "ass",
              )
            }
            ?: return@forEach

        val language =
          metadata.optString("language")
            .replace(
              Regex("[^A-Za-z0-9-]"),
              "",
            )
            .take(12)
            .ifBlank {
              "und"
            }

        val label =
          metadata.optString("label")
            .replace(
              Regex("[\\u0000-\\u001f\\u007f]"),
              "",
            )
            .trim()
            .take(120)
            .ifBlank {
              "${language.uppercase()} subtitle"
            }

        subtitles +=
          OrionOfflinePlayerSubtitle(
            id = id,
            language = language,
            label = label,
            format = format,
            isDefault =
              metadata.optBoolean(
                "default",
                subtitles.isEmpty(),
              ),
            file = file,
          )
      }

      return OrionOfflinePlayerResolution(
        asset =
          OrionOfflinePlayerAsset(
            assetId = clean,
            sourceKind = "file",
            fragmentCount = 1,
            videoParts = emptyList(),
            audioParts = emptyList(),
            videoMediaCount = 1,
            audioMediaCount = 0,
            subtitles = subtitles,
            mediaFile = bundleDir,
          ),
        stage = "ready",
      )
    }

    val validated = validateManagedFragmentBundle(bundleDir)
      ?: return failure("bundle-integrity", "offline-bundle-invalid", "Offline media fragments are missing or inconsistent.")
    val entries = validated.index.optJSONArray("files")
      ?: return failure("bundle-index", "offline-bundle-files-missing", "Offline stream index is incomplete.")
    val fragments = mutableListOf<OrionOfflineMediaSourcePolicy.IndexedFragment>()
    for (index in 0 until entries.length()) {
      val entry = entries.optJSONObject(index)
        ?: return failure("fragment-entry", "offline-fragment-entry-invalid", "Offline stream index is invalid.", index)
      fragments += OrionOfflineMediaSourcePolicy.IndexedFragment(
        index = index,
        name = entry.optString("name"),
        role = entry.optString("role"),
        sizeBytes = entry.optLong("size", -1L),
      )
    }
    val plan = OrionOfflineMediaSourcePolicy.build(validated.index.optString("kind"), fragments)
      ?: return failure("source-plan", "offline-source-plan-invalid", "Offline media roles cannot be opened safely.")
    fun materialize(parts: List<OrionOfflineMediaSourcePolicy.IndexedFragment>): List<OrionOfflinePlayerPart>? {
      val output = mutableListOf<OrionOfflinePlayerPart>()
      for (part in parts) {
        val file = File(bundleDir, part.name)
        if (!OrionDownloadOwnershipPolicy.canonicalContained(bundleDir, file) || !file.isFile || file.length() != part.sizeBytes) return null
        output += OrionOfflinePlayerPart(part.index, file)
      }
      return output
    }
    val videoParts = materialize(plan.videoParts)
      ?: return failure("video-parts", "offline-video-fragment-invalid", "Offline video fragments could not be opened safely.")
    val audioParts = materialize(plan.audioParts)
      ?: return failure("audio-parts", "offline-audio-fragment-invalid", "Offline audio fragments could not be opened safely.")
    val subtitleEntries = validated.index.optJSONArray("subtitles") ?: JSONArray()
    val trackMetadata = asset.optJSONArray("tracks") ?: JSONArray()
    val subtitles = mutableListOf<OrionOfflinePlayerSubtitle>()
    for (subtitleIndex in 0 until subtitleEntries.length()) {
      val entry = subtitleEntries.optJSONObject(subtitleIndex)
        ?: return failure("subtitle-entry", "offline-subtitle-entry-invalid", "Downloaded subtitles could not be opened safely.")
      val id = entry.optString("id").takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,100}$")) }
        ?: return failure("subtitle-id", "offline-subtitle-id-invalid", "Downloaded subtitles could not be opened safely.")
      val name = entry.optString("name")
      val file = File(bundleDir, name)
      if (!OrionDownloadOwnershipPolicy.canonicalContained(bundleDir, file) || !file.isFile || file.length() != entry.optLong("size", -1L)) {
        return failure("subtitle-file", "offline-subtitle-file-invalid", "Downloaded subtitles could not be opened safely.")
      }
      val metadata = (0 until trackMetadata.length())
        .mapNotNull { trackMetadata.optJSONObject(it) }
        .firstOrNull { it.optString("kind") == "subtitle" && it.optString("id") == id }
      val format = metadata?.optString("format").orEmpty().lowercase().takeIf { it in setOf("vtt", "srt", "ass") }
        ?: file.extension.lowercase().takeIf { it in setOf("vtt", "srt", "ass") }
        ?: return failure("subtitle-format", "offline-subtitle-format-invalid", "Downloaded subtitles could not be opened safely.")
      val language = metadata?.optString("language").orEmpty().ifBlank { entry.optString("language") }
        .replace(Regex("[^A-Za-z0-9-]"), "").take(12).ifBlank { "und" }
      val label = metadata?.optString("label").orEmpty()
        .replace(Regex("[\\u0000-\\u001f\\u007f]"), "").trim().take(120)
        .ifBlank { "${language.uppercase()} subtitle" }
      subtitles += OrionOfflinePlayerSubtitle(
        id = id,
        language = language,
        label = label,
        format = format,
        isDefault = metadata?.optBoolean("default", subtitleIndex == 0) ?: (subtitleIndex == 0),
        file = file,
      )
    }
    return OrionOfflinePlayerResolution(
      asset = OrionOfflinePlayerAsset(
        assetId = clean,
        sourceKind = plan.sourceKind,
        fragmentCount = fragments.size,
        videoParts = videoParts,
        audioParts = audioParts,
        videoMediaCount = plan.videoMediaCount,
        audioMediaCount = plan.audioMediaCount,
        subtitles = subtitles,
      ),
      stage = "ready",
    )
  }

  fun deleteSelected(context: Context, selections: List<OrionDownloadManagementSelection>): JSONObject {
    val ids = selections.map { it.assetId }.filter { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }.toSet()
    return deleteAssets(context, ids, expectedSelections = selections.filter { it.assetId in ids })
  }

  fun deleteAssets(
    context: Context,
    requestedIds: Set<String>,
    staleOnly: Boolean = false,
    expectedSelections: List<OrionDownloadManagementSelection>? = null,
  ): JSONObject {
    val ids = requestedIds.filter { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }.toSet()
    if (ids.isEmpty()) return result(ids)
    reconcile(context, ids)
    val currentAssets = OrionDownloadJobStore.ownershipAssets(ids)
    val currentTokens = linkedMapOf<String, String>()
    for (index in 0 until currentAssets.length()) {
      currentAssets.optJSONObject(index)?.let { asset ->
        asset.optString("assetId").takeIf { it.isNotBlank() }?.let { assetId ->
          currentTokens[assetId] = OrionDownloadJobStore.managementToken(asset)
        }
      }
    }
    val authorization = expectedSelections?.let { OrionDownloadOwnershipPolicy.authorizeSelection(it, currentTokens) }
    val authorizedIds = authorization?.approvedAssetIds ?: ids
    val assets = OrionDownloadJobStore.ownershipAssets(authorizedIds)
    val knownIds = linkedSetOf<String>()
    val retained = linkedSetOf<String>()
    val failures = JSONArray()
    val stateUpdates = JSONArray()
    val expectedOwnership = linkedMapOf<String, String>()
    val plannedDispositions = linkedMapOf<String, OrionAssetManagementDisposition>()
    val finalDispositions = linkedMapOf<String, OrionAssetManagementDisposition>()
    var reclaimed = 0L
    authorization?.rejectedAssetIds?.forEach { assetId ->
      knownIds.add(assetId)
      retained.add(assetId)
      finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
      val exists = currentTokens.containsKey(assetId)
      failures.put(failure(
        assetId,
        null,
        if (exists) "asset-selection-stale" else "asset-not-found",
        if (exists) "The selected download changed after confirmation. Orion kept it." else "Download record not found.",
      ))
    }
    for (assetIndex in 0 until assets.length()) {
      val asset = assets.optJSONObject(assetIndex) ?: continue
      val assetId = asset.optString("assetId")
      knownIds.add(assetId)
      val artifacts = asset.optJSONArray("_artifacts") ?: JSONArray()
      val primary = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
      if (staleOnly && primary?.optString("availability") != "missing") {
        retained.add(assetId)
        finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        failures.put(failure(assetId, null, "artifact-not-missing", "Only a conclusively missing download can have its stale record removed."))
        continue
      }
      val decisions = mutableListOf<OrionArtifactDeleteDecision>()
      val ordered = (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.sortedBy { if (it.optString("role") == "primary") 1 else 0 }
      for (artifact in ordered) {
        val artifactId = artifact.optString("artifactId")
        val state = OrionOwnedArtifactState(
          assetId = assetId,
          artifactId = artifactId,
          role = artifact.optString("role"),
          availability = OrionArtifactAvailability.fromWire(artifact.optString("availability")),
          observedBytes = if (artifact.isNull("observedSizeBytes")) null else artifact.optLong("observedSizeBytes").coerceAtLeast(0L),
        )
        val decision = OrionDownloadOwnershipPolicy.decideArtifactDeletion(state) { deleteArtifact(context, asset, artifact) }
        decisions.add(decision)
        reclaimed = safeAdd(reclaimed, decision.reclaimedBytes)
        if (decision.disposition != OrionArtifactDeleteDisposition.UNAVAILABLE) {
          stateUpdates.put(JSONObject()
            .put("artifactId", artifactId)
            .put("_locatorFingerprint", artifact.optJSONObject("_locator")?.toString() ?: "")
            .put("availability", "missing")
            .put("observedSizeBytes", JSONObject.NULL)
            .put("lastCheckedAt", System.currentTimeMillis()))
        } else {
          failures.put(failure(assetId, artifactId, "artifact-delete-unavailable", "Android could not confirm deletion of this exact Orion-owned artifact."))
        }
      }
      val disposition = OrionDownloadOwnershipPolicy.assetDeletionDisposition(decisions)
      if (OrionDownloadOwnershipPolicy.canRemoveAsset(decisions.map { it.disposition })) {
        expectedOwnership[assetId] = OrionDownloadJobStore.ownershipFingerprint(asset)
        plannedDispositions[assetId] = disposition
      } else {
        retained.add(assetId)
        finalDispositions[assetId] = disposition
      }
    }
    for (assetId in ids - knownIds) {
      retained.add(assetId)
      finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
      failures.put(failure(assetId, null, "asset-not-found", "Download record not found."))
    }
    val commit = OrionDownloadJobStore.applyArtifactManagement(stateUpdates, expectedOwnership)
    for ((assetId, disposition) in plannedDispositions) {
      if (commit.removedAssetIds.contains(assetId)) finalDispositions[assetId] = disposition
      else {
        retained.add(assetId)
        finalDispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        failures.put(failure(assetId, null, "artifact-ownership-changed", "The tracked artifact changed while Android was handling it. Orion kept the record."))
      }
    }
    return result(ids, commit.removedAssetIds, retained, reclaimed, failures, outcomes(ids, finalDispositions))
  }

  fun removeUnavailableRecords(context: Context, requestedIds: Set<String>): JSONObject {
    val ids = requestedIds.filter { it.matches(Regex("^[A-Za-z0-9._:-]{1,140}$")) }.toSet()
    if (ids.isEmpty()) return result(ids)
    reconcile(context, ids)
    val assets = OrionDownloadJobStore.ownershipAssets(ids)
    val knownIds = linkedSetOf<String>()
    val retained = linkedSetOf<String>()
    val failures = JSONArray()
    val expectedOwnership = linkedMapOf<String, String>()
    val dispositions = linkedMapOf<String, OrionAssetManagementDisposition>()
    for (assetIndex in 0 until assets.length()) {
      val asset = assets.optJSONObject(assetIndex) ?: continue
      val assetId = asset.optString("assetId")
      knownIds.add(assetId)
      val primary = ownedPrimary(asset)
      val availability = primary?.let { OrionArtifactAvailability.fromWire(it.optString("availability")) }
      if (OrionDownloadOwnershipPolicy.canRemoveUnavailableRecord(availability)) {
        expectedOwnership[assetId] = OrionDownloadJobStore.ownershipFingerprint(asset)
      } else {
        retained.add(assetId)
        dispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        val code = if (availability == OrionArtifactAvailability.MISSING) "artifact-is-missing" else "artifact-not-unavailable"
        val message = if (availability == OrionArtifactAvailability.MISSING) {
          "This artifact is conclusively missing. Use Delete to remove its stale record."
        } else {
          "Only an unavailable download can be removed from Orion without physical deletion."
        }
        failures.put(failure(assetId, primary?.optString("artifactId"), code, message))
      }
    }
    for (assetId in ids - knownIds) {
      retained.add(assetId)
      dispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
      failures.put(failure(assetId, null, "asset-not-found", "Download record not found."))
    }
    val commit = OrionDownloadJobStore.applyArtifactManagement(
      JSONArray(),
      expectedOwnership,
      OrionArtifactAvailability.UNAVAILABLE,
    )
    for (assetId in expectedOwnership.keys) {
      if (commit.removedAssetIds.contains(assetId)) dispositions[assetId] = OrionAssetManagementDisposition.REMOVED_FROM_ORION
      else {
        retained.add(assetId)
        dispositions[assetId] = OrionAssetManagementDisposition.RETAINED_FAILED
        failures.put(failure(assetId, null, "artifact-ownership-changed", "Artifact availability changed before Orion could remove the record."))
      }
    }
    return result(ids, commit.removedAssetIds, retained, 0L, failures, outcomes(ids, dispositions))
  }

  fun deleteAll(context: Context): JSONObject {
    val assets = OrionDownloadJobStore.ownershipAssets()
    val ids = linkedSetOf<String>()
    for (index in 0 until assets.length()) assets.optJSONObject(index)?.optString("assetId")?.takeIf { it.isNotBlank() }?.let(ids::add)
    return deleteAssets(context, ids)
  }

  fun open(context: Context, assetId: String, locate: Boolean): JSONObject {
    reconcile(context, setOf(assetId))
    val asset = OrionDownloadJobStore.ownershipAssets(setOf(assetId)).optJSONObject(0)
      ?: return actionResult(false, "asset-not-found", "Download not found.")
    val primary = ownedPrimary(asset) ?: return actionResult(false, "artifact-not-found", "Downloaded media is not tracked.")
    when (primary.optString("availability")) {
      "missing" -> return actionResult(false, "artifact-missing", "The downloaded media file is missing from Orion Library.")
      "unavailable" -> return actionResult(false, "artifact-unavailable", "Android could not verify or open the downloaded media file.")
      "verified" -> Unit
      else -> return actionResult(false, "artifact-not-verified", "This download is not currently verified.")
    }
    val locator = primary.optJSONObject("_locator") ?: return actionResult(false, "artifact-locator-missing", "This download cannot be opened.")
    val locatorKind = locator.optString("kind")
    if (locatorKind == "content-uri") {
      val document = parseContentUri(locator.optString("value")) ?: return actionResult(false, "artifact-locator-invalid", "This download cannot be opened.")
      val userOwnedPrimary = asset.optString("destination") == "orion-library" &&
        asset.optJSONObject("storageTarget")?.optString("mode") == "user-folder"
      if (userOwnedPrimary) {
        val expectedSize = primary.optLong("expectedSizeBytes", -1L)
        if (!OrionFinalizedArtifactPolicy.verificationStampMatches(
            primary.optInt("_verificationVersion", 0),
            primary.optLong("_verifiedByteCount", -1L),
            expectedSize,
            primary.optString("_contentSha256"),
          ) || OrionFinalizedArtifactOwner.authorizeDocument(context, document, expectedSize) == null
        ) return actionResult(false, "artifact-integrity-invalid", "This Orion Library document is no longer a verified MP4.")
      }
      if (locate) {
        val targetId = asset.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
        val tree = OrionDownloadStorageRegistry.resolveTreeUri(context, targetId)
        if (tree != null && launch(context, tree, null, chooser = false)) return actionResult(true, null, null)
      }
      val mime = primary.optString("mimeType").takeIf { it.isNotBlank() && it != "null" } ?: asset.optString("mimeType", "video/mp4")
      return if (launch(context, document, mime, chooser = true)) actionResult(true, null, null)
      else actionResult(false, "artifact-action-unsupported", "No Android app can play this saved download.")
    }
    if (locate || locatorKind != "managed-relative" || asset.optString("container") != "mp4") {
      return actionResult(false, "artifact-action-unsupported", "This download cannot be opened outside Orion.")
    }
    val target = managedTarget(context, asset, primary)
      ?: return actionResult(false, "artifact-locator-invalid", "This download cannot be opened.")
    val expectedSize = primary.optLong("expectedSizeBytes", -1L)
    if (!target.isFile || expectedSize <= 0L || target.length() != expectedSize || !target.extension.equals("mp4", true)) {
      return actionResult(false, "artifact-integrity-invalid", "This download is no longer a verified MP4.")
    }
    if (!OrionFinalizedArtifactPolicy.verificationStampMatches(
        primary.optInt("_verificationVersion", 0),
        primary.optLong("_verifiedByteCount", -1L),
        expectedSize,
        primary.optString("_contentSha256"),
      )) {
      return actionResult(false, "artifact-verification-required", "This download has not passed durable playback verification.")
    }
    val contentUri = OrionFinalizedArtifactOwner.authorize(context, target, expectedSize)
      ?: return actionResult(false, "artifact-authority-unavailable", "Orion could not open this download through its local playback authority.")
    return if (launch(context, contentUri, "video/mp4", chooser = true)) actionResult(true, null, null)
    else actionResult(false, "artifact-action-unsupported", "No Android app can play this saved download.")
  }

  private fun probeArtifact(
    context: Context,
    asset: JSONObject,
    artifact: JSONObject,
    purpose: OrionArtifactReconciliationPurpose,
    checkedAt: Long,
  ): ArtifactProbe {
    val locator = artifact.optJSONObject("_locator") ?: return ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
    return when (locator.optString("kind")) {
      "content-uri" -> {
        val document = parseContentUri(locator.optString("value"))
          ?: return ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
        when (val probe = OrionDownloadStorageRegistry.probeDocument(context, document)) {
          is OrionDownloadStorageRegistry.DocumentProbe.Verified -> {
            val userOwnedPrimary = asset.optString("destination") == "orion-library" &&
              asset.optJSONObject("storageTarget")?.optString("mode") == "user-folder" &&
              artifact.optString("role") == "primary"
            if (!userOwnedPrimary) {
              ArtifactProbe(OrionArtifactAvailability.VERIFIED, probe.sizeBytes)
            } else {
              val expectedSize = artifact.optLong("expectedSizeBytes", -1L)
              val stampValid = OrionFinalizedArtifactPolicy.verificationStampMatches(
                artifact.optInt("_verificationVersion", 0),
                artifact.optLong("_verifiedByteCount", -1L),
                expectedSize,
                artifact.optString("_contentSha256"),
              )
              if (probe.sizeBytes != expectedSize) {
                ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, probe.sizeBytes, clearVerification = true)
              } else {
                val previousIntegrityCheckedAt = OrionArtifactIntegrityPolicy.previousIntegrityCheckedAt(
                  artifact.optLong("_integrityCheckedAt", -1L),
                  artifact.optLong("lastCheckedAt", -1L),
                )
                val deepVerify = OrionArtifactIntegrityPolicy.requiresDigestVerification(
                  purpose = purpose,
                  stampValid = stampValid,
                  integrityCheckedAt = artifact.optLong("_integrityCheckedAt", -1L),
                  legacyLastCheckedAt = artifact.optLong("lastCheckedAt", -1L),
                  now = checkedAt,
                )
                if (!deepVerify) {
                  ArtifactProbe(
                    availability = OrionArtifactAvailability.VERIFIED,
                    observedSizeBytes = probe.sizeBytes,
                    integrityCheckedAt = previousIntegrityCheckedAt,
                  )
                } else {
                  val targetId = asset.optJSONObject("storageTarget")?.optString("targetId").orEmpty()
                  when (
                    val validation = OrionFinalizedArtifactOwner.validateDocumentIntegrity(
                      context = context,
                      uri = document,
                      targetId = targetId,
                      displayName = artifact.optString("displayName", "Orion Download.mp4"),
                      expectedSizeBytes = expectedSize,
                      expectedSha256 = artifact.optString("_contentSha256").takeIf { stampValid },
                      requireAudio = true,
                    )
                  ) {
                    is OrionFinalizedDocumentSettlement.Verified -> ArtifactProbe(
                      availability = OrionArtifactAvailability.VERIFIED,
                      observedSizeBytes = validation.proof.sizeBytes,
                      verificationVersion = OrionFinalizedArtifactPolicy.VERIFICATION_VERSION,
                      verifiedByteCount = validation.proof.sizeBytes,
                      contentSha256 = validation.proof.sha256,
                      integrityCheckedAt = checkedAt,
                    )
                    is OrionFinalizedDocumentSettlement.Failed -> ArtifactProbe(
                      availability = OrionArtifactAvailability.UNAVAILABLE,
                      observedSizeBytes = probe.sizeBytes,
                      clearVerification = true,
                    )
                    OrionFinalizedDocumentSettlement.Cancelled -> ArtifactProbe(
                      availability = OrionArtifactAvailability.UNAVAILABLE,
                      observedSizeBytes = probe.sizeBytes,
                    )
                  }
                }
              }
            }
          }
          OrionDownloadStorageRegistry.DocumentProbe.Missing ->
            ArtifactProbe(OrionArtifactAvailability.MISSING, null, clearVerification = true)
          OrionDownloadStorageRegistry.DocumentProbe.Unavailable ->
            ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
        }
      }
      "managed", "managed-relative" -> {
        val target = managedTarget(context, asset, artifact)
          ?: return ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
        if (!target.exists()) {
          ArtifactProbe(OrionArtifactAvailability.MISSING, null, clearVerification = true)
        } else if (artifact.optString("role") == "primary" && target.isDirectory) {
          val validated = validateManagedFragmentBundle(target)
          val expectedSize = artifact.optLong("expectedSizeBytes", -1L)
          if (validated == null || expectedSize <= 0L || validated.primaryBytes != expectedSize) {
            ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
          } else {
            ArtifactProbe(OrionArtifactAvailability.VERIFIED, validated.primaryBytes)
          }
        } else if (artifact.optString("role") == "primary" && target.isFile) {
          val expectedSize = artifact.optLong("expectedSizeBytes", -1L)
          if (expectedSize <= 0L || target.length() != expectedSize) {
            ArtifactProbe(
              availability = OrionArtifactAvailability.UNAVAILABLE,
              observedSizeBytes = target.length().takeIf { it >= 0L },
              clearVerification = true,
            )
          } else if (
            asset.optString("container") == "mp4" &&
            asset.optString("mimeType") == "video/mp4"
          ) {
            val contentSha256 = artifact.optString("_contentSha256")
            val stampValid = OrionFinalizedArtifactPolicy.verificationStampMatches(
              artifact.optInt("_verificationVersion", 0),
              artifact.optLong("_verifiedByteCount", -1L),
              expectedSize,
              contentSha256,
            )
            val previousIntegrityCheckedAt = OrionArtifactIntegrityPolicy.previousIntegrityCheckedAt(
              artifact.optLong("_integrityCheckedAt", -1L),
              artifact.optLong("lastCheckedAt", -1L),
            )
            val deepVerify = OrionArtifactIntegrityPolicy.requiresDigestVerification(
              purpose = purpose,
              stampValid = stampValid,
              integrityCheckedAt = artifact.optLong("_integrityCheckedAt", -1L),
              legacyLastCheckedAt = artifact.optLong("lastCheckedAt", -1L),
              now = checkedAt,
            )
            if (stampValid && !deepVerify) {
              ArtifactProbe(
                availability = OrionArtifactAvailability.VERIFIED,
                observedSizeBytes = expectedSize,
                integrityCheckedAt = previousIntegrityCheckedAt,
              )
            } else {
              when (
                val validation = OrionFinalizedArtifactOwner.validate(
                  context = context,
                  file = target,
                  expectedSizeBytes = expectedSize,
                  expectedSha256 = contentSha256.takeIf { stampValid },
                  requireAudio = true,
                )
              ) {
                is OrionFinalizedArtifactSettlement.Verified -> ArtifactProbe(
                  availability = OrionArtifactAvailability.VERIFIED,
                  observedSizeBytes = validation.proof.sizeBytes,
                  verificationVersion = OrionFinalizedArtifactPolicy.VERIFICATION_VERSION,
                  verifiedByteCount = validation.proof.sizeBytes,
                  contentSha256 = validation.proof.sha256,
                  integrityCheckedAt = checkedAt,
                )
                is OrionFinalizedArtifactSettlement.Failed -> ArtifactProbe(
                  availability =
                    if (validation.code == "finalized-artifact-missing") OrionArtifactAvailability.MISSING
                    else OrionArtifactAvailability.UNAVAILABLE,
                  observedSizeBytes = null,
                  clearVerification = true,
                )
              }
            }
          } else {
            ArtifactProbe(OrionArtifactAvailability.VERIFIED, expectedSize)
          }
        } else {
          val expectedSize = artifact.optLong("expectedSizeBytes", -1L)
          val observed = managedSize(target, false)
          if (expectedSize <= 0L || observed != expectedSize) ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
          else ArtifactProbe(OrionArtifactAvailability.VERIFIED, observed)
        }
      }
      else -> ArtifactProbe(OrionArtifactAvailability.UNAVAILABLE, null)
    }
  }

  private fun deleteArtifact(context: Context, asset: JSONObject, artifact: JSONObject): OrionArtifactDeleteResult {
    val locator = artifact.optJSONObject("_locator") ?: return OrionArtifactDeleteResult.UNAVAILABLE
    return when (locator.optString("kind")) {
      "content-uri" -> {
        val uri = parseContentUri(locator.optString("value")) ?: return OrionArtifactDeleteResult.UNAVAILABLE
        when (OrionDownloadStorageRegistry.deleteDocument(context, uri)) {
          OrionDownloadStorageRegistry.DocumentDeleteResult.Deleted -> OrionArtifactDeleteResult.DELETED
          OrionDownloadStorageRegistry.DocumentDeleteResult.AlreadyMissing -> OrionArtifactDeleteResult.ALREADY_MISSING
          OrionDownloadStorageRegistry.DocumentDeleteResult.Unavailable -> OrionArtifactDeleteResult.UNAVAILABLE
        }
      }
      "managed", "managed-relative" -> {
        val target = managedTarget(context, asset, artifact) ?: return OrionArtifactDeleteResult.UNAVAILABLE
        if (!target.exists()) OrionArtifactDeleteResult.ALREADY_MISSING
        else {
          val deleted = if (target.isDirectory) target.deleteRecursively() else target.delete()
          when {
            deleted -> OrionArtifactDeleteResult.DELETED
            !target.exists() -> OrionArtifactDeleteResult.ALREADY_MISSING
            else -> OrionArtifactDeleteResult.UNAVAILABLE
          }
        }
      }
      else -> OrionArtifactDeleteResult.UNAVAILABLE
    }
  }

  private fun managedTarget(context: Context, asset: JSONObject, artifact: JSONObject): File? {
    val root = File(context.filesDir, "orion-downloads/library")
    val locator = artifact.optJSONObject("_locator") ?: return null
    val raw = locator.optString("value")
    val relative = when (locator.optString("kind")) {
      "managed-relative" -> raw
      "managed" -> {
        val jobId = asset.optString("jobId").takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,120}$")) } ?: return null
        if (File(root, "$jobId.fragments").exists()) "$jobId.fragments" else "$jobId.mp4"
      }
      else -> return null
    }
    if (relative.isBlank() || File(relative).isAbsolute) return null
    val target = File(root, relative)
    return target.takeIf { OrionDownloadOwnershipPolicy.canonicalContained(root, it) }
  }


  private data class ValidatedFragmentBundle(
    val index: JSONObject,
    val primaryBytes: Long,
  )

  private fun validateManagedFragmentBundle(directory: File): ValidatedFragmentBundle? {
    if (!directory.isDirectory || !directory.name.endsWith(".fragments")) return null
    val indexFile = File(directory, "orion-fragment-bundle.json")
    if (!indexFile.isFile || indexFile.length() <= 0L || indexFile.length() > MAX_FRAGMENT_INDEX_BYTES) return null
    val index = try { JSONObject(indexFile.readText(Charsets.UTF_8)) } catch (_: Throwable) { return null }
    if (index.optInt("schemaVersion", 0) != 1) return null
    if (index.optString("kind") !in setOf("hls", "dash")) return null
    val files = index.optJSONArray("files") ?: return null
    val fragmentCount = index.optInt("fragmentCount", -1)
    if (fragmentCount != files.length() || fragmentCount !in 1..MAX_FRAGMENT_COUNT) return null

    var total = indexFile.length().coerceAtLeast(0L)
    var videoSegments = 0
    for (fragmentIndex in 0 until files.length()) {
      val entry = files.optJSONObject(fragmentIndex) ?: return null
      val expectedName = "f${fragmentIndex.toString().padStart(6, '0')}.bin"
      if (entry.optString("name") != expectedName) return null
      val role = entry.optString("role")
      if (role !in FRAGMENT_ROLES) return null
      if (role == "video") videoSegments += 1
      val expectedSize = entry.optLong("size", -1L)
      if (expectedSize <= 0L) return null
      val file = File(directory, expectedName)
      if (!OrionDownloadOwnershipPolicy.canonicalContained(directory, file) || !file.isFile || file.length() != expectedSize) return null
      total = safeAdd(total, expectedSize)
    }
    if (videoSegments == 0) return null

    val subtitles = index.optJSONArray("subtitles") ?: JSONArray()
    if (subtitles.length() > 2) return null
    for (subtitleIndex in 0 until subtitles.length()) {
      val entry = subtitles.optJSONObject(subtitleIndex) ?: return null
      val name = entry.optString("name")
      if (!name.matches(Regex("^subtitles/[A-Za-z0-9._-]{1,120}$"))) return null
      val expectedSize = entry.optLong("size", -1L)
      val file = File(directory, name)
      if (expectedSize <= 0L || !OrionDownloadOwnershipPolicy.canonicalContained(directory, file) || !file.isFile || file.length() != expectedSize) return null
    }
    return ValidatedFragmentBundle(index, total)
  }

  private fun playbackResult(ok: Boolean, assetId: String, code: String?, message: String?): JSONObject = JSONObject()
    .put("schemaVersion", 1)
    .put("ok", ok)
    .put("assetId", assetId)
    .put("code", code ?: JSONObject.NULL)
    .put("message", message ?: JSONObject.NULL)

  private fun managedSize(target: File, primary: Boolean): Long {
    if (target.isFile) return target.length().coerceAtLeast(0L)
    val files = target.listFiles() ?: return 0L
    return files.fold(0L) { total, file ->
      if (file.isFile || !primary) safeAdd(total, if (file.isFile) file.length().coerceAtLeast(0L) else directorySize(file)) else total
    }
  }

  private fun directorySize(directory: File): Long = (directory.listFiles() ?: emptyArray()).fold(0L) { total, file ->
    safeAdd(total, if (file.isDirectory) directorySize(file) else file.length().coerceAtLeast(0L))
  }

  private fun ownedPrimary(asset: JSONObject): JSONObject? {
    val artifacts = asset.optJSONArray("_artifacts") ?: return null
    return (0 until artifacts.length()).mapNotNull { artifacts.optJSONObject(it) }.firstOrNull { it.optString("role") == "primary" }
  }

  private fun finalizedSubtitlePayload(context: Context, asset: JSONObject): JSONArray? {
    val artifacts = asset.optJSONArray("_artifacts") ?: return JSONArray()
    val tracks = asset.optJSONArray("tracks") ?: JSONArray()
    val trackById = (0 until tracks.length())
      .mapNotNull { tracks.optJSONObject(it) }
      .filter { it.optString("kind") == "subtitle" }
      .associateBy { it.optString("id") }
    val result = JSONArray()
    for (index in 0 until artifacts.length()) {
      val artifact = artifacts.optJSONObject(index) ?: return null
      if (artifact.optString("role") != "subtitle") continue
      if (result.length() >= MAX_FINALIZED_SUBTITLES || artifact.optString("availability") != "verified") return null
      val trackId = artifact.optString("_trackId").takeIf { it.matches(Regex("^[A-Za-z0-9._:-]{1,100}$")) } ?: return null
      val track = trackById[trackId] ?: return null
      val file = managedTarget(context, asset, artifact) ?: return null
      val expected = artifact.optLong("expectedSizeBytes", -1L)
      val format = file.extension.lowercase().takeIf { it in setOf("vtt", "srt", "ass") } ?: return null
      if (!file.isFile || expected <= 0L || expected > MAX_FINALIZED_SUBTITLE_BYTES || file.length() != expected) return null
      val content = try { file.readText(Charsets.UTF_8) } catch (_: Throwable) { return null }
      if (content.isBlank() || content.length > MAX_FINALIZED_SUBTITLE_CHARS || content.indexOf('\u0000') >= 0) return null
      val language = track.optString("language", "und").take(12).ifBlank { "und" }
      val label = track.optString("label", "${language.uppercase()} subtitle").take(120)
      result.put(JSONObject()
        .put("id", trackId)
        .put("language", language)
        .put("label", label)
        .put("format", format)
        .put("default", track.optBoolean("default", result.length() == 0))
        .put("content", content))
    }
    return result
  }

  private fun launch(context: Context, uri: Uri, mimeType: String?, chooser: Boolean): Boolean = try {
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, mimeType)
      clipData = ClipData.newRawUri("Orion download", uri)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val launchIntent = if (chooser) Intent.createChooser(intent, "Play locally").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    } else intent
    // Starting the chooser is the authoritative capability check. A preflight
    // package-resolution preflights can return null under Android visibility rules
    // even when a compatible player is available.
    context.startActivity(launchIntent)
    true
  } catch (_: Throwable) { false }

  private fun parseContentUri(value: String): Uri? = try { Uri.parse(value).takeIf { it.scheme == "content" } } catch (_: Throwable) { null }

  private fun failure(assetId: String, artifactId: String?, code: String, message: String) = JSONObject()
    .put("assetId", assetId)
    .put("artifactId", artifactId ?: JSONObject.NULL)
    .put("code", code)
    .put("message", message)

  private fun result(
    requested: Set<String>,
    removed: Set<String> = emptySet(),
    retained: Set<String> = emptySet(),
    reclaimed: Long = 0L,
    failures: JSONArray = JSONArray(),
    outcomes: JSONArray = JSONArray(),
  ) = JSONObject()
    .put("schemaVersion", 1)
    .put("requestedAssetIds", JSONArray(requested.toList()))
    .put("deletedAssetIds", JSONArray(removed.toList()))
    .put("retainedAssetIds", JSONArray(retained.toList()))
    .put("reclaimedBytes", reclaimed)
    .put("failures", failures)
    .put("outcomes", outcomes)

  private fun outcomes(
    requested: Set<String>,
    dispositions: Map<String, OrionAssetManagementDisposition>,
  ): JSONArray {
    val output = JSONArray()
    for (assetId in requested) {
      val disposition = dispositions[assetId] ?: continue
      output.put(JSONObject().put("assetId", assetId).put("disposition", disposition.wire))
    }
    return output
  }

  private fun actionResult(ok: Boolean, code: String?, message: String?) = JSONObject()
    .put("ok", ok)
    .put("code", code ?: JSONObject.NULL)
    .put("message", message ?: JSONObject.NULL)

  private fun safeAdd(left: Long, right: Long): Long = if (right <= 0L) left else if (left > Long.MAX_VALUE - right) Long.MAX_VALUE else left + right
}
