/**
 * Lightweight WebRTC voice chat controller for 2-player co-op.
 * Captures local microphone audio with echo cancellation and exposes mute/deafen controls.
 */

export function createVoiceChat({ onStateChange } = {}) {
  let localStream = null;
  let muted = true;
  let deafened = false;
  let activePeer = null;
  let audioEl = null;

  const emit = () => {
    onStateChange?.({
      active: Boolean(localStream),
      muted,
      deafened,
    });
  };

  async function enableMic(peerConnection) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone not supported in this browser');
    }
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    }
    muted = false;
    for (const track of localStream.getAudioTracks()) {
      track.enabled = true;
      if (peerConnection && peerConnection !== activePeer) {
        peerConnection.addTrack(track, localStream);
      }
    }
    if (peerConnection) activePeer = peerConnection;
    emit();
    return localStream;
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    emit();
  }

  function setDeafened(nextDeafened) {
    deafened = Boolean(nextDeafened);
    if (audioEl) audioEl.muted = deafened;
    emit();
  }

  function attachRemoteStream(stream) {
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
    }
    audioEl.srcObject = stream;
    audioEl.muted = deafened;
    audioEl.play?.().catch(() => {});
  }

  function stop() {
    if (localStream) {
      for (const track of localStream.getTracks()) track.stop();
      localStream = null;
    }
    if (audioEl) {
      audioEl.srcObject = null;
    }
    activePeer = null;
    muted = true;
    emit();
  }

  return {
    enableMic,
    setMuted,
    setDeafened,
    attachRemoteStream,
    stop,
    getState: () => ({ active: Boolean(localStream), muted, deafened }),
  };
}
