package com.okali.waven.playback;

import android.net.Uri;
import androidx.media3.common.C;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.TransferListener;
import java.io.EOFException;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Bounded provider HTTP reads beneath Media3; no player, cache or disk ownership. */
@UnstableApi
public final class WavenRemoteRangeDataSource implements DataSource {
  private static final long CHUNK_BYTES = 1024 * 1024;
  private static final Pattern CONTENT_RANGE = Pattern.compile("bytes \\d+-\\d+/(\\d+)");
  private final DataSource upstream;
  private DataSpec original;
  private boolean bounded;
  private long position, remaining, chunkRemaining;

  public static final class Factory implements DataSource.Factory {
    private final DataSource.Factory upstream;
    public Factory(DataSource.Factory upstream) { this.upstream = upstream; }
    @Override public DataSource createDataSource() { return new WavenRemoteRangeDataSource(upstream.createDataSource()); }
  }
  public WavenRemoteRangeDataSource(DataSource upstream) { this.upstream = upstream; }
  @Override public void addTransferListener(TransferListener listener) { upstream.addTransferListener(listener); }
  @Override public long open(DataSpec spec) throws IOException {
    original = spec;
    String host = spec.uri.getHost();
    bounded = "https".equals(spec.uri.getScheme()) && host != null
      && "/videoplayback".equals(spec.uri.getPath())
      && (host.equalsIgnoreCase("googlevideo.com") || host.toLowerCase(java.util.Locale.ROOT).endsWith(".googlevideo.com"))
      && spec.httpMethod == DataSpec.HTTP_METHOD_GET && spec.httpBody == null;
    if (!bounded) return upstream.open(spec);
    position = spec.position;
    remaining = spec.length;
    openChunk();
    long total = documentLength(upstream.getResponseHeaders());
    if (total < position || total == C.LENGTH_UNSET) { upstream.close(); throw new IOException("WAVEN_SOURCE_RANGE_LENGTH_UNAVAILABLE"); }
    remaining = spec.length == C.LENGTH_UNSET ? total - position : Math.min(spec.length, total - position);
    return remaining;
  }
  private void openChunk() throws IOException {
    chunkRemaining = remaining == C.LENGTH_UNSET ? CHUNK_BYTES : Math.min(CHUNK_BYTES, remaining);
    Map<String, String> headers = new LinkedHashMap<>();
    original.httpRequestHeaders.forEach((name, value) -> { if (!name.equalsIgnoreCase("Range")) headers.put(name, value); });
    upstream.open(original.buildUpon().setPosition(position).setLength(chunkRemaining).setHttpRequestHeaders(headers).build());
  }
  static long documentLength(Map<String, List<String>> headers) {
    for (Map.Entry<String, List<String>> header : headers.entrySet()) {
      if (header.getKey() != null && header.getKey().equalsIgnoreCase("Content-Range")) {
        for (String value : header.getValue()) {
          Matcher match = CONTENT_RANGE.matcher(value);
          if (match.matches()) { try { return Long.parseLong(match.group(1)); } catch (NumberFormatException ignored) { } }
        }
      }
    }
    return C.LENGTH_UNSET;
  }
  @Override public int read(byte[] buffer, int offset, int length) throws IOException {
    if (!bounded) return upstream.read(buffer, offset, length);
    if (length == 0) return 0;
    if (remaining == 0) return C.RESULT_END_OF_INPUT;
    if (chunkRemaining == 0) { upstream.close(); openChunk(); }
    int read = upstream.read(buffer, offset, (int)Math.min(length, Math.min(remaining, chunkRemaining)));
    if (read == C.RESULT_END_OF_INPUT) throw new EOFException("WAVEN_SOURCE_RANGE_TRUNCATED");
    position += read; remaining -= read; chunkRemaining -= read;
    return read;
  }
  @Override public Uri getUri() { return upstream.getUri(); }
  @Override public Map<String, List<String>> getResponseHeaders() { return upstream.getResponseHeaders(); }
  @Override public void close() throws IOException { original = null; bounded = false; remaining = 0; upstream.close(); }
}
