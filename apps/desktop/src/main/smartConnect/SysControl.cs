using System;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;

namespace OrionSystemControl {
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume {
        int RegisterControlChangeNotify(IAudioEndpointVolumeCallback pNotify);
        int UnregisterControlChangeNotify(IAudioEndpointVolumeCallback pNotify);
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
        int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
        int VolumeStepUp(ref Guid pguidEventContext);
        int VolumeStepDown(ref Guid pguidEventContext);
        int QueryHardwareSupport(out uint pdwHardwareSupportMask);
        int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
    }

    [Guid("657804FA-D6AD-4496-8A60-352752AF4F89"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolumeCallback {
        int OnNotify(IntPtr pNotifyData);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object aev);
        int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
        int GetState(out int pdwState);
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
        int RegisterEndpointNotificationCallback(IntPtr pClient);
        int UnregisterEndpointNotificationCallback(IntPtr pClient);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorComObject { }

    class VolumeCallback : IAudioEndpointVolumeCallback {
        public int OnNotify(IntPtr pNotifyData) {
            try {
                bool muted = Marshal.ReadInt32(pNotifyData, 16) != 0;
                byte[] bytes = new byte[4];
                Marshal.Copy(new IntPtr(pNotifyData.ToInt64() + 20), bytes, 0, 4);
                float volume = BitConverter.ToSingle(bytes, 0);
                int percent = (int)Math.Round(volume * 100);
                Console.WriteLine("{\"event\":\"volume_changed\",\"volume\":" + percent + ",\"muted\":" + (muted ? "true" : "false") + "}");
                Console.Out.Flush();
            } catch { }
            return 0;
        }
    }

    class Program {
        static IAudioEndpointVolume _vol;
        static Guid _emptyGuid = Guid.Empty;

        static IAudioEndpointVolume GetVolumeEndpoint() {
            if (_vol != null) return _vol;
            try {
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                IMMDevice dev;
                int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                if (hr != 0 || dev == null) return null;
                var iid = typeof(IAudioEndpointVolume).GUID;
                object epvObj;
                hr = dev.Activate(ref iid, 23, IntPtr.Zero, out epvObj);
                if (hr != 0 || epvObj == null) return null;
                _vol = (IAudioEndpointVolume)epvObj;
                return _vol;
            } catch {
                return null;
            }
        }

        static string GetVolumeJson() {
            var vol = GetVolumeEndpoint();
            if (vol == null) return "{\"ok\":false,\"error\":\"Audio endpoint unavailable\"}";
            try {
                float level;
                vol.GetMasterVolumeLevelScalar(out level);
                bool muted;
                vol.GetMute(out muted);
                int percent = (int)Math.Round(level * 100);
                return "{\"ok\":true,\"volume\":" + percent + ",\"muted\":" + (muted ? "true" : "false") + "}";
            } catch (Exception ex) {
                return "{\"ok\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        static string SetVolumeJson(int percent) {
            var vol = GetVolumeEndpoint();
            if (vol == null) return "{\"ok\":false,\"error\":\"Audio endpoint unavailable\"}";
            try {
                percent = Math.Max(0, Math.Min(100, percent));
                float level = percent / 100.0f;
                vol.SetMasterVolumeLevelScalar(level, ref _emptyGuid);
                bool muted;
                vol.GetMute(out muted);
                return "{\"ok\":true,\"volume\":" + percent + ",\"muted\":" + (muted ? "true" : "false") + "}";
            } catch (Exception ex) {
                return "{\"ok\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        static string SetMuteJson(string mode) {
            var vol = GetVolumeEndpoint();
            if (vol == null) return "{\"ok\":false,\"error\":\"Audio endpoint unavailable\"}";
            try {
                bool currentMute;
                vol.GetMute(out currentMute);
                bool newMute = mode == "toggle" ? !currentMute : (mode == "true" || mode == "1");
                vol.SetMute(newMute, ref _emptyGuid);
                float level;
                vol.GetMasterVolumeLevelScalar(out level);
                int percent = (int)Math.Round(level * 100);
                return "{\"ok\":true,\"volume\":" + percent + ",\"muted\":" + (newMute ? "true" : "false") + "}";
            } catch (Exception ex) {
                return "{\"ok\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        static string GetBrightnessJson() {
            try {
                using (var searcher = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM WmiMonitorBrightness"))
                using (var results = searcher.Get()) {
                    foreach (ManagementObject obj in results) {
                        var active = (bool)obj["Active"];
                        if (active) {
                            var current = Convert.ToInt32(obj["CurrentBrightness"]);
                            return "{\"ok\":true,\"supported\":true,\"brightness\":" + current + "}";
                        }
                    }
                }
                return "{\"ok\":true,\"supported\":false}";
            } catch {
                return "{\"ok\":true,\"supported\":false}";
            }
        }

        static string SetBrightnessJson(int brightness) {
            brightness = Math.Max(0, Math.Min(100, brightness));
            try {
                using (var searcher = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM WmiMonitorBrightnessMethods"))
                using (var results = searcher.Get()) {
                    foreach (ManagementObject obj in results) {
                        obj.InvokeMethod("WmiSetBrightness", new object[] { 1, (byte)brightness });
                        return "{\"ok\":true,\"supported\":true,\"brightness\":" + brightness + "}";
                    }
                }
                return "{\"ok\":false,\"supported\":false,\"error\":\"Display brightness control not supported\"}";
            } catch (Exception ex) {
                return "{\"ok\":false,\"supported\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        static void Main(string[] args) {
            if (args.Length > 0 && args[0] == "daemon") {
                RunDaemon();
                return;
            }
            if (args.Length == 0) {
                Console.WriteLine(GetVolumeJson());
                return;
            }
            string cmd = args[0].ToLowerInvariant();
            if (cmd == "volume") {
                string sub = args.Length > 1 ? args[1].ToLowerInvariant() : "get";
                if (sub == "get") Console.WriteLine(GetVolumeJson());
                else if (sub == "set" && args.Length > 2) {
                    int p;
                    if (int.TryParse(args[2], out p)) Console.WriteLine(SetVolumeJson(p));
                    else Console.WriteLine("{\"ok\":false,\"error\":\"Invalid volume percentage\"}");
                } else if (sub == "mute") {
                    string m = args.Length > 2 ? args[2].ToLowerInvariant() : "toggle";
                    Console.WriteLine(SetMuteJson(m));
                }
            } else if (cmd == "brightness") {
                string sub = args.Length > 1 ? args[1].ToLowerInvariant() : "get";
                if (sub == "get") Console.WriteLine(GetBrightnessJson());
                else if (sub == "set" && args.Length > 2) {
                    int b;
                    if (int.TryParse(args[2], out b)) Console.WriteLine(SetBrightnessJson(b));
                    else Console.WriteLine("{\"ok\":false,\"error\":\"Invalid brightness percentage\"}");
                }
            }
        }

        static void RunDaemon() {
            var vol = GetVolumeEndpoint();
            VolumeCallback cb = null;
            if (vol != null) {
                cb = new VolumeCallback();
                vol.RegisterControlChangeNotify(cb);
            }
            Console.WriteLine("{\"status\":\"ready\"}");
            Console.Out.Flush();

            string line;
            while ((line = Console.ReadLine()) != null) {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;
                if (line == "exit" || line == "quit") break;

                string[] parts = line.Split(' ');
                string cmd = parts[0].ToLowerInvariant();
                if (cmd == "volume") {
                    string sub = parts.Length > 1 ? parts[1].ToLowerInvariant() : "get";
                    if (sub == "get") Console.WriteLine(GetVolumeJson());
                    else if (sub == "set" && parts.Length > 2) {
                        int p;
                        if (int.TryParse(parts[2], out p)) Console.WriteLine(SetVolumeJson(p));
                        else Console.WriteLine("{\"ok\":false,\"error\":\"Invalid volume\"}");
                    } else if (sub == "mute") {
                        string m = parts.Length > 2 ? parts[2].ToLowerInvariant() : "toggle";
                        Console.WriteLine(SetMuteJson(m));
                    }
                } else if (cmd == "brightness") {
                    string sub = parts.Length > 1 ? parts[1].ToLowerInvariant() : "get";
                    if (sub == "get") Console.WriteLine(GetBrightnessJson());
                    else if (sub == "set" && parts.Length > 2) {
                        int b;
                        if (int.TryParse(parts[2], out b)) Console.WriteLine(SetBrightnessJson(b));
                        else Console.WriteLine("{\"ok\":false,\"error\":\"Invalid brightness\"}");
                    }
                }
                Console.Out.Flush();
            }

            if (vol != null && cb != null) {
                vol.UnregisterControlChangeNotify(cb);
            }
        }
    }
}
