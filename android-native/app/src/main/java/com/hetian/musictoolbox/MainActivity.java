package com.hetian.musictoolbox;

import android.Manifest;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 1001;
    private WebView webView;
    private PermissionRequest pendingMediaRequest;
    private final Object audioLock = new Object();
    private volatile boolean nativeAudioRunning = false;
    private volatile byte[] latestPcm = new byte[0];
    private AudioRecord nativeAudioRecord;
    private Thread nativeAudioThread;
    private int nativeSampleRate = 48000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        webView.addJavascriptInterface(new OrientationBridge(), "AndroidOrientation");
        webView.addJavascriptInterface(new AudioPermissionBridge(), "AndroidAudio");

        // 关键修复：用 WebViewAssetLoader 通过 https://appassets.androidplatform.net 提供本地资源
        // file:// 协议在多数 WebView 版本中不属于安全上下文，导致 navigator.mediaDevices 为 undefined
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsAudio = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
                    }
                    if (!wantsAudio) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingMediaRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingMediaRequest == request) pendingMediaRequest = null;
            }
        });
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private class OrientationBridge {
        @JavascriptInterface
        public void setLandscape(boolean landscape) {
            runOnUiThread(() -> setRequestedOrientation(
                landscape
                    ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            ));
        }
    }

    /**
     * Android WebView may dispatch getUserMedia before its own permission
     * request has completed. The web layer calls this bridge from the user's
     * button gesture, waits for RECORD_AUDIO, and only then opens the source.
     */
    private class AudioPermissionBridge {
        @JavascriptInterface
        public boolean hasPermission() {
            return checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestPermission() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(
                            new String[]{Manifest.permission.RECORD_AUDIO},
                            AUDIO_PERMISSION_REQUEST
                    );
                }
            });
        }

        /**
         * Some vendor WebViews grant RECORD_AUDIO but still cannot create a
         * MediaStream. This native PCM path is used only as a fallback.
         */
        @JavascriptInterface
        public boolean startCapture() {
            return startNativeCapture();
        }

        @JavascriptInterface
        public String readPcmBase64() {
            byte[] snapshot;
            synchronized (audioLock) {
                snapshot = latestPcm.clone();
            }
            return snapshot.length == 0
                    ? ""
                    : Base64.encodeToString(snapshot, Base64.NO_WRAP);
        }

        @JavascriptInterface
        public int getSampleRate() {
            return nativeSampleRate;
        }

        @JavascriptInterface
        public void stopCapture() {
            stopNativeCapture();
        }
    }

    private boolean startNativeCapture() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) return false;
        synchronized (audioLock) {
            if (nativeAudioRunning && nativeAudioRecord != null) return true;
        }

        int[] sampleRates = new int[]{48000, 44100, 16000};
        int[] sources = new int[]{
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                MediaRecorder.AudioSource.MIC
        };
        AudioRecord created = null;
        int chosenRate = 48000;
        for (int source : sources) {
            for (int rate : sampleRates) {
                int minimum = AudioRecord.getMinBufferSize(
                        rate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT
                );
                if (minimum <= 0) continue;
                try {
                    AudioRecord candidate = new AudioRecord(
                            source,
                            rate,
                            AudioFormat.CHANNEL_IN_MONO,
                            AudioFormat.ENCODING_PCM_16BIT,
                            Math.max(minimum * 2, 16384)
                    );
                    if (candidate.getState() == AudioRecord.STATE_INITIALIZED) {
                        created = candidate;
                        chosenRate = rate;
                        break;
                    }
                    candidate.release();
                } catch (RuntimeException ignored) {
                    // Try the next source/rate combination.
                }
            }
            if (created != null) break;
        }
        if (created == null) return false;

        final AudioRecord recorder = created;
        nativeSampleRate = chosenRate;
        try {
            recorder.startRecording();
        } catch (RuntimeException error) {
            recorder.release();
            return false;
        }
        synchronized (audioLock) {
            nativeAudioRecord = recorder;
            nativeAudioRunning = true;
            latestPcm = new byte[0];
        }
        nativeAudioThread = new Thread(() -> {
            short[] samples = new short[4096];
            while (nativeAudioRunning) {
                int count = recorder.read(samples, 0, samples.length, AudioRecord.READ_BLOCKING);
                if (count <= 0) continue;
                byte[] pcm = new byte[count * 2];
                for (int i = 0; i < count; i++) {
                    pcm[i * 2] = (byte) (samples[i] & 0xff);
                    pcm[i * 2 + 1] = (byte) ((samples[i] >> 8) & 0xff);
                }
                synchronized (audioLock) {
                    latestPcm = pcm;
                }
            }
        }, "MusicToolboxNativeAudio");
        nativeAudioThread.setDaemon(true);
        nativeAudioThread.start();
        return true;
    }

    private void stopNativeCapture() {
        AudioRecord recorder;
        synchronized (audioLock) {
            nativeAudioRunning = false;
            recorder = nativeAudioRecord;
            nativeAudioRecord = null;
            latestPcm = new byte[0];
        }
        if (recorder != null) {
            try { recorder.stop(); } catch (RuntimeException ignored) {}
            recorder.release();
        }
        nativeAudioThread = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AUDIO_PERMISSION_REQUEST && pendingMediaRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingMediaRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else pendingMediaRequest.deny();
            pendingMediaRequest = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        stopNativeCapture();
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.MusicVocal&&window.MusicVocal.audioInputManager&&window.MusicVocal.audioInputManager.stopAll()",
                    null
            );
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        stopNativeCapture();
        if (pendingMediaRequest != null) {
            pendingMediaRequest.deny();
            pendingMediaRequest = null;
        }
        webView.loadUrl("about:blank");
        webView.destroy();
        super.onDestroy();
    }
}
