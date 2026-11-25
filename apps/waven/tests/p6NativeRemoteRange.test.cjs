const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// Compile the production Java transport with small interface-only host stubs.
// Android/Media3 linkage is separately verified by assembleDebug and the device gate.
test('native ranged transport reads every byte across chunks, seeks, preserves headers and rejects truncation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'waven-range-test-'));
  const sources = {
    'android/net/Uri.java': `package android.net; public final class Uri {
      private final java.net.URI value; private Uri(String s){value=java.net.URI.create(s);}
      public static Uri parse(String s){return new Uri(s);} public String getHost(){return value.getHost();}
      public String getScheme(){return value.getScheme();} public String getPath(){return value.getPath();} }`,
    'androidx/media3/common/C.java': 'package androidx.media3.common; public final class C { public static final int LENGTH_UNSET=-1, RESULT_END_OF_INPUT=-1; }',
    'androidx/media3/common/util/UnstableApi.java': 'package androidx.media3.common.util; public @interface UnstableApi {}',
    'androidx/media3/datasource/TransferListener.java': 'package androidx.media3.datasource; public interface TransferListener {}',
    'androidx/media3/datasource/DataSource.java': `package androidx.media3.datasource; public interface DataSource {
      interface Factory { DataSource createDataSource(); } void addTransferListener(TransferListener l);
      long open(DataSpec s) throws java.io.IOException; int read(byte[] b,int o,int n) throws java.io.IOException;
      android.net.Uri getUri(); java.util.Map<String,java.util.List<String>> getResponseHeaders(); void close() throws java.io.IOException; }`,
    'androidx/media3/datasource/DataSpec.java': `package androidx.media3.datasource; public final class DataSpec {
      public static final int HTTP_METHOD_GET=1; public android.net.Uri uri; public int httpMethod=1; public byte[] httpBody;
      public long position=0,length=-1; public java.util.Map<String,String> httpRequestHeaders=java.util.Map.of();
      public Builder buildUpon(){return new Builder(this);} public static class Builder {
        private final DataSpec s=new DataSpec(); public Builder(DataSpec old){s.uri=old.uri;s.httpMethod=old.httpMethod;s.httpBody=old.httpBody;s.position=old.position;s.length=old.length;s.httpRequestHeaders=old.httpRequestHeaders;}
        public Builder setPosition(long v){s.position=v;return this;} public Builder setLength(long v){s.length=v;return this;}
        public Builder setHttpRequestHeaders(java.util.Map<String,String> h){s.httpRequestHeaders=h;return this;} public DataSpec build(){return s;}
      } }`,
    'com/okali/waven/playback/RangeTest.java': `package com.okali.waven.playback;
      import androidx.media3.datasource.*; import android.net.Uri; import java.util.*; import java.io.*;
      public final class RangeTest {
        static final int SIZE=2500123; static void check(boolean v){if(!v)throw new AssertionError();}
        static class Fake implements DataSource {
          List<DataSpec> requests=new ArrayList<>(); int pos, end, closes; boolean unknown=false,truncated=false;
          public void addTransferListener(TransferListener l){} public long open(DataSpec s){requests.add(s);pos=(int)s.position;end=s.length<0?SIZE:(int)Math.min(SIZE,pos+s.length);return end-pos;}
          public int read(byte[] b,int o,int n){if(truncated||pos>=end)return -1;int size=Math.min(n,end-pos);for(int i=0;i<size;i++)b[o+i]=(byte)((pos+i)%251);pos+=size;return size;}
          public Uri getUri(){return requests.get(requests.size()-1).uri;}
          public Map<String,List<String>> getResponseHeaders(){return unknown?Map.of():Map.of("content-range",List.of("bytes "+(requests.get(requests.size()-1).position)+"-"+(end-1)+"/"+SIZE));}
          public void close(){closes++;}
        }
        static DataSpec spec(String host,long pos,long length){DataSpec s=new DataSpec();s.uri=Uri.parse("https://"+host+"/videoplayback");s.position=pos;s.length=length;s.httpRequestHeaders=Map.of("User-Agent","catalog-agent","Range","bytes=0-");return s;}
        static void consume(WavenRemoteRangeDataSource source,int start,int expected)throws Exception{
          byte[] buffer=new byte[7919];int count=0,n;check(source.read(buffer,0,0)==0);
          while((n=source.read(buffer,0,buffer.length))!=-1){for(int i=0;i<n;i++)check(buffer[i]==(byte)((start+count+i)%251));count+=n;}check(count==expected);
        }
        public static void main(String[] args)throws Exception{
          Fake f=new Fake();WavenRemoteRangeDataSource s=new WavenRemoteRangeDataSource(f);
          check(s.open(spec("rr.example.googlevideo.com",0,-1))==SIZE);consume(s,0,SIZE);check(f.requests.size()==3);
          for(DataSpec r:f.requests){check(r.length>0&&r.length<=1048576);check(!r.httpRequestHeaders.containsKey("Range"));check("catalog-agent".equals(r.httpRequestHeaders.get("User-Agent")));}s.close();check(f.closes==3);
          f=new Fake();s=new WavenRemoteRangeDataSource(f);check(s.open(spec("googlevideo.com",1048563,1000000))==1000000);consume(s,1048563,1000000);s.close();
          f=new Fake();s=new WavenRemoteRangeDataSource(f);check(s.open(spec("googlevideo.com",SIZE-17,-1))==17);consume(s,SIZE-17,17);s.close();
          f=new Fake();s=new WavenRemoteRangeDataSource(f);s.open(spec("googlevideo.com.evil.test",0,-1));check(f.requests.get(0).length==-1);s.close();
          f=new Fake();f.unknown=true;s=new WavenRemoteRangeDataSource(f);DataSpec hls=spec("rr.example.googlevideo.com",0,-1);hls.uri=Uri.parse("https://rr.example.googlevideo.com/videoplayback/id/segment");s.open(hls);check(f.requests.get(0).length==-1);s.close();
          f=new Fake();f.unknown=true;s=new WavenRemoteRangeDataSource(f);try{s.open(spec("googlevideo.com",0,-1));throw new AssertionError();}catch(IOException expected){check(f.closes==1);}
          f=new Fake();f.truncated=true;s=new WavenRemoteRangeDataSource(f);s.open(spec("googlevideo.com",0,-1));try{s.read(new byte[2],0,2);throw new AssertionError();}catch(EOFException expected){}s.close();
          check(WavenRemoteRangeDataSource.documentLength(Map.of("Content-Range",List.of("bytes 0-15/9999999999999999999999999")))==-1);
          System.out.println("PASS: full multi-chunk bytes, seek, tail, provider boundary, headers, unknown length, truncation and overflow");
        }
      }`,
  };
  const files = Object.entries(sources).map(([name, source]) => {
    const target = path.join(directory, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, source); return target;
  });
  const jdk = process.env.JAVA_HOME || 'C:/Program Files/Microsoft/jdk-17.0.19.10-hotspot';
  const binary = name => fs.existsSync(path.join(jdk, 'bin', `${name}.exe`)) ? path.join(jdk, 'bin', `${name}.exe`) : name;
  const compile = spawnSync(binary('javac'), ['-d', directory, ...files, path.join(__dirname, '../plugins/waven-playback-native/WavenRemoteRangeDataSource.java')], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
  const run = spawnSync(binary('java'), ['-cp', directory, 'com.okali.waven.playback.RangeTest'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.error?.message); assert.match(run.stdout, /PASS: full multi-chunk/);
});
