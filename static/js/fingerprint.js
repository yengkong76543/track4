console.log("[FP] fingerprint.js loaded"); 
console.log("[FP] collecting fingerprint...");

// Browser Fingerprinting - Based on browser-fingerprinting-main project
// Source: https://github.com/niespodd/browser-fingerprinting
// Converted from React components to vanilla JavaScript

class BrowserFingerprint {
  constructor() {
    this.data = {};
  }

  // ============================================
  // FROM: BasicInformation.jsx
  // ============================================
  async collectBasicInformation() {
    // DevTools detection - from BasicInformation.jsx lines 6-24
    const devToolsOpened = () => {
      // based on: https://github.com/sindresorhus/devtools-detect/blob/main/index.js
      let devtools = {};
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      const orientation = widthThreshold ? 'vertical' : 'horizontal';
      if (
        !(heightThreshold && widthThreshold) &&
        ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold)
      ) {
        devtools.isOpen = true;
        devtools.orientation = orientation;
      } else {
        devtools.isOpen = false;
        devtools.orientation = undefined;
      }
      return devtools;
    };

    // Stack limit probe - from BasicInformation.jsx lines 26-42
    const probeStackLimit = async () => {
      let accessor = 'window.parent';
      let p = 0;
      while (true) {
        p += 500;
        try {
          eval(accessor);
        } catch (err) {
          break;
        }
        for (let i = 0; i < 500; i++) {
          accessor += '.parent';
        }
        await new Promise((resolve) => setTimeout(resolve, 50)); // helps to prevent early freeze/crash
      }
      return p;
    };

    // Connection information - from BasicInformation.jsx lines 44-53
    const getConnectionInformation = async () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) return {};
      return {
        effectiveType: connection.effectiveType,
        saveData: connection.saveData,
        rtt: connection.rtt,
        downlink: connection.downlink,
      };
    };

    // Average FPS - from BasicInformation.jsx lines 55-65
    const getAvgFPS = async () => {
      let c = 0, r = true;
      const onRaf = () => {
        if (!r) return; else c++;
        window.requestAnimationFrame(onRaf);
      };
      window.requestAnimationFrame(onRaf);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      r = false;
      return Math.round(c / 20) * 10;
    };

    // Main collection - from BasicInformation.jsx lines 68-94
    let result = {
      navigator: {
        deviceMemory: navigator.deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
      },
      window: {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        outerHeight: window.outerHeight,
        outerWidth: window.outerWidth,
      },
      document: {
        hasFocus: document.hasFocus(),
        visibilityState: document.visibilityState,
      }
    };
    result.devtools = devToolsOpened();
    result.stackLimit = await probeStackLimit();
    result.connection = await getConnectionInformation();
    try {
      result.performance = {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        roundedAvgFps: await getAvgFPS(),
      };
    } catch (err) {}

    return result;
  }

  // ============================================
  // FROM: MediaDevices.jsx
  // ============================================
  async collectMediaDevices() {
    // From MediaDevices.jsx lines 6-15
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInput: devices.filter((d) => d.kind === "audioinput").length,
        audioOutput: devices.filter((d) => d.kind === "audiooutput").length,
        videoInput: devices.filter((d) => d.kind === "videoinput").length,
        supportedConstraints: Object.entries(await navigator.mediaDevices.getSupportedConstraints())
          .map(([k, v]) => !!v ? k : false)
          .filter(Boolean)
      };
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // FROM: DeviceSensors.jsx
  // ============================================
  async collectDeviceSensors() {
    // From DeviceSensors.jsx lines 91-107
    let aclReporting = false;
    if ('Accelerometer' in window) {
      let acl = new window.Accelerometer({ frequency: 60 });
      acl.onreading = (e) => {
        aclReporting = true;
        acl.stop();
      };
      acl.start();
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return [
      ["Accelerometer in window", 'Accelerometer' in window],
      ["Support DeviceOrientationEvent?", !!window.DeviceOrientationEvent],
      ["Accelerometer reporting?", aclReporting]
    ];
  }

  // ============================================
  // FROM: ResourceTiming.jsx
  // ============================================
  async collectResourceTiming() {
    // From ResourceTiming.jsx lines 69-83
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const performanceEntries = window.performance.getEntries();
      const navigationTiming = performanceEntries.find((k) => k instanceof PerformanceNavigationTiming);
      return {
        navigationType: navigationTiming.type,
        encodedBodySize: navigationTiming.encodedBodySize,
        entriesCount: performanceEntries.length,
        domainLookupTime: navigationTiming.domainLookupEnd - navigationTiming.domainLookupStart,
      };
    } catch (err) {
      return {};
    }
  }

  // ============================================
  // FROM: EncryptedMediaExtensions.jsx
  // ============================================
  async collectEncryptedMediaExtensions() {
    // From EncryptedMediaExtensions.jsx lines 6-37
    const keySystems = {
      widevine: ['com.widevine.alpha'],
      playready: ['com.microsoft.playready', 'com.youtube.playready'],
      clearkey: ['webkit-org.w3.clearkey', 'org.w3.clearkey'],
      primetime: ['com.adobe.primetime', 'com.adobe.access'],
      fairplay: ['com.apple.fairplay']
    };

    if (!('requestMediaKeySystemAccess' in window.navigator)) {
      return null;
    }

    let result = [];
    for (const [name, keySystemKeys] of Object.entries(keySystems)) {
      for (const keySystemKey of keySystemKeys) {
        try {
          await window.navigator.requestMediaKeySystemAccess(keySystemKey, [{
            initDataTypes: ['keyids', 'webm']
          }, {
            audioCapabilities: [{
              contentType: 'audio/webm; codecs="opus"'
            }],
          }]);
          result.push({ name, keySystemKey, supported: true });
        } catch (err) {
          result.push({ name, keySystemKey, supported: false });
        }
      }
    }
    return result;
  }

  // ============================================
  // FROM: DocumentStatus.jsx
  // ============================================
  collectDocumentStatus() {
    // From DocumentStatus.jsx lines 7-14
    return {
      document: {
        hasFocus: document.hasFocus() ? "yes" : "no",
        hidden: document.hidden ? "yes" : "no",
        compatMode: document.compatMode,
        documentURI: document.documentURI,
        designMode: document.designMode,
      }
    };
  }

  // ============================================
  // FROM: SpeechSynthesis.jsx
  // ============================================
  async collectSpeechSynthesis() {
    // From SpeechSynthesis.jsx lines 16-25
    let voicesList = [];
    for (let i = 0; i < 10; i++) {
      voicesList = window.speechSynthesis.getVoices();
      if (voicesList.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return voicesList.map((v) => ({ lang: v.lang, name: v.name.slice(0, 24) }));
  }

  // ============================================
  // FROM: FeaturePolicy.jsx
  // ============================================
  async collectFeaturePolicy() {
    // From FeaturePolicy.jsx line 6
    try {
      if (document.featurePolicy) {
        return document.featurePolicy.features();
      }
    } catch (e) {}
    return null;
  }

  // ============================================
  // FROM: PerformanceMemory.jsx (concept)
  // ============================================
  collectPerformanceMemory() {
    // From PerformanceMemory.jsx concept - just get current memory state
    try {
      if (performance.memory) {
        return {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize,
        };
      }
    } catch (e) {}
    return null;
  }

  // ============================================
  // FROM: ChromeExtensions.jsx (simplified)
  // ============================================
  collectChromeExtensions() {
    // Simplified version - detect if chrome.runtime is available
    try {
      if (window.chrome && window.chrome.runtime) {
        return { chromeRuntimeAvailable: true };
      }
    } catch (e) {}
    return null;
  }

  // ============================================
  // Additional: Canvas & WebGL (standard fingerprinting)
  // ============================================
  getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('fingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('fingerprint', 4, 17);
      return canvas.toDataURL();
    } catch (e) {
      return null;
    }
  }

  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        debugRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
        debugVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
      };
    } catch (e) {
      return null;
    }
  }

  async getAudioFingerprint() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 10000;
      gainNode.gain.value = 0;

      return new Promise((resolve) => {
        scriptProcessor.onaudioprocess = (event) => {
          const output = event.inputBuffer.getChannelData(0);
          let hash = 0;
          for (let i = 0; i < output.length; i++) {
            hash += Math.abs(output[i]);
          }
          oscillator.disconnect();
          analyser.disconnect();
          scriptProcessor.disconnect();
          gainNode.disconnect();
          audioContext.close();
          resolve(hash.toString());
        };
        oscillator.start(0);
        setTimeout(() => {
          oscillator.stop();
          resolve(null);
        }, 100);
      });
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // Main collection method
  // ============================================
  async collect() {
    this.data.timestamp = new Date().toISOString();

    // Collect all data from browser-fingerprinting-main testers
    this.data.basic = await this.collectBasicInformation();
    this.data.mediaDevices = await this.collectMediaDevices();
    this.data.sensors = await this.collectDeviceSensors();
    this.data.resourceTiming = await this.collectResourceTiming();
    this.data.encryptedMedia = await this.collectEncryptedMediaExtensions();
    this.data.document = this.collectDocumentStatus();
    this.data.speechSynthesis = await this.collectSpeechSynthesis();
    this.data.featurePolicy = await this.collectFeaturePolicy();
    this.data.performanceMemory = this.collectPerformanceMemory();
    this.data.chromeExtensions = this.collectChromeExtensions();

    // Additional standard fingerprinting
    this.data.canvas = this.getCanvasFingerprint();
    this.data.webgl = this.getWebGLFingerprint();
    this.data.audio = await this.getAudioFingerprint();

    // Additional navigator properties
    this.data.navigator = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages || [],
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      maxTouchPoints: navigator.maxTouchPoints,
      vendor: navigator.vendor,
      vendorSub: navigator.vendorSub,
      product: navigator.product,
      productSub: navigator.productSub,
    };

    // Screen properties
    this.data.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    };

    // Timezone
    this.data.timezone = {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
    };

    return this.data;
  }

  async send(data) {
    console.log("[FP] sending fingerprint");
    try {
      const response = await fetch('/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      console.log("[FP] server status:", response.status);
      return await response.json();
    } catch (e) {
      console.error("[FP] send error", e); 
      // Silent fail
      return null;
    }
  }
}

// Auto-run fingerprinting when page loads
(function() {
  'use strict';
  let executed = false;

  function init() {
    if (executed) return;
    executed = true;
    
    console.log("[FP] collecting fingerprint...");
    
    try {
      const collector = new BrowserFingerprint();
      collector.collect().then(fp => {
        if (fp && Object.keys(fp).length > 0) {
          collector.send(fp);
        }
      }).catch(err => {
        // Silent fail
      });
    } catch (e) {
      // Silent fail
    }
  }

  // Multiple triggers to ensure it runs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', init);
  setTimeout(init, 500);
  setTimeout(init, 1500);
})();
