import React, { useState, useEffect } from 'react';
import VoiceSettingsService, {
  VOICE_PRESETS,
  RESPONSE_PAUSES,
  VAD_SENSITIVITIES
} from '../../services/voiceSettingsService';
import VoicePreview from './VoicePreview';

const VoiceSettingsPanel = ({ value, onChange, compact = false }) => {
  const [settings, setSettings] = useState(() => value || VoiceSettingsService.loadSettings());
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);

  // Discover voices on mount
  useEffect(() => {
    let isMounted = true;
    async function loadVoices() {
      try {
        const available = await VoiceSettingsService.getAvailableVoices();
        if (isMounted) {
          setVoices(available);
          setLoadingVoices(false);

          // If current voiceURI is empty and voices exist, pick best default
          if (!settings.voiceURI && available.length > 0) {
            const defaultVoice = available.find(v => v.isEnglish) || available[0];
            updateField('voiceURI', defaultVoice.voiceURI);
            updateField('voiceName', defaultVoice.displayName);
            updateField('language', defaultVoice.lang);
          }
        }
      } catch (err) {
        if (isMounted) setLoadingVoices(false);
      }
    }

    loadVoices();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field, val) => {
    const updated = {
      ...settings,
      [field]: val,
      preset: field === 'preset' ? val : 'custom'
    };
    const validated = VoiceSettingsService.validateSettings(updated);
    setSettings(validated);
    VoiceSettingsService.saveSettings(validated);
    if (onChange) onChange(validated);
  };

  const handleVoiceSelect = (e) => {
    const uri = e.target.value;
    const selectedVoice = voices.find(v => v.voiceURI === uri);
    const updated = {
      ...settings,
      voiceURI: uri,
      voiceName: selectedVoice ? selectedVoice.displayName : 'Default AI Voice',
      language: selectedVoice ? selectedVoice.lang : 'en-US'
    };
    const validated = VoiceSettingsService.validateSettings(updated);
    setSettings(validated);
    VoiceSettingsService.saveSettings(validated);
    if (onChange) onChange(validated);
  };

  const handleApplyPreset = (presetKey) => {
    const applied = VoiceSettingsService.applyPreset(presetKey, settings);
    setSettings(applied);
    VoiceSettingsService.saveSettings(applied);
    if (onChange) onChange(applied);
  };

  return (
    <div className={`voice-settings-panel ${compact ? 'compact' : ''}`}>
      <div className="voice-panel-header">
        <div className="panel-title-row">
          <span className="panel-icon">🎙️</span>
          <div>
            <h4>AI Interviewer Voice & Cadence</h4>
            <p className="panel-subtitle">Configure how the AI interviewer sounds and speaks</p>
          </div>
        </div>
      </div>

      <div className="voice-settings-grid">
        {/* Preset Selector */}
        <div className="setting-group preset-group">
          <label className="setting-label">Voice Persona Preset</label>
          <div className="preset-pill-group">
            {Object.keys(VOICE_PRESETS).map((key) => {
              const p = VOICE_PRESETS[key];
              const isSelected = settings.preset === key;
              return (
                <button
                  type="button"
                  key={key}
                  className={`preset-pill ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleApplyPreset(key)}
                  title={p.desc}
                >
                  <span className="preset-name">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Voice Selection Dropdown */}
        <div className="setting-group">
          <label className="setting-label">AI Interviewer Voice</label>
          {loadingVoices ? (
            <div className="voice-loading-select">
              <span className="spinner-mini"></span> Loading system voices...
            </div>
          ) : voices.length === 0 ? (
            <div className="voice-fallback-badge">
              <span>Standard Browser Speech Voice</span>
            </div>
          ) : (
            <div className="voice-select-wrapper">
              <select
                className="voice-select-dropdown"
                value={settings.voiceURI}
                onChange={handleVoiceSelect}
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Speaking Speed (Rate) */}
        <div className="setting-group">
          <div className="slider-label-row">
            <span className="setting-label">Speaking Speed</span>
            <span className="slider-val-badge">{settings.speakingRate.toFixed(2)}×</span>
          </div>
          <div className="slider-track-box">
            <span className="slider-hint left">0.75× (Slow)</span>
            <input
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={settings.speakingRate}
              onChange={(e) => updateField('speakingRate', parseFloat(e.target.value))}
              className="voice-slider"
            />
            <span className="slider-hint right">1.35× (Fast)</span>
          </div>
        </div>

        {/* Pitch Slider */}
        <div className="setting-group">
          <div className="slider-label-row">
            <span className="setting-label">Voice Pitch</span>
            <span className="slider-val-badge">{settings.pitch.toFixed(2)}</span>
          </div>
          <div className="slider-track-box">
            <span className="slider-hint left">Low (0.8)</span>
            <input
              type="range"
              min="0.8"
              max="1.25"
              step="0.05"
              value={settings.pitch}
              onChange={(e) => updateField('pitch', parseFloat(e.target.value))}
              className="voice-slider"
            />
            <span className="slider-hint right">High (1.25)</span>
          </div>
        </div>

        {/* Volume Slider */}
        <div className="setting-group">
          <div className="slider-label-row">
            <span className="setting-label">Volume</span>
            <span className="slider-val-badge">{Math.round(settings.volume * 100)}%</span>
          </div>
          <div className="slider-track-box">
            <span className="slider-hint left">Mute</span>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={settings.volume}
              onChange={(e) => updateField('volume', parseFloat(e.target.value))}
              className="voice-slider"
            />
            <span className="slider-hint right">100%</span>
          </div>
        </div>

        {/* Response Pause Timing */}
        <div className="setting-group">
          <label className="setting-label">Interviewer Response Pacing</label>
          <div className="radio-pill-group">
            {Object.keys(RESPONSE_PAUSES).map((key) => (
              <button
                type="button"
                key={key}
                className={`radio-pill ${settings.responsePause === key ? 'selected' : ''}`}
                onClick={() => updateField('responsePause', key)}
              >
                {RESPONSE_PAUSES[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Preview Section */}
      <div className="voice-panel-footer">
        <VoicePreview settings={settings} />
      </div>
    </div>
  );
};

export default VoiceSettingsPanel;
