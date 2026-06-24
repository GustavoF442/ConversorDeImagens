import React from 'react';
import { ProcessingSettings, FileInfo } from '../types';

interface RightPanelProps {
  settings: ProcessingSettings;
  onSettingsChange: (settings: ProcessingSettings) => void;
  selectedFile: FileInfo | null;
}

const SIZE_PRESETS = [
  { label: '50×50', w: 50, h: 50 },
  { label: '60×40', w: 60, h: 40 },
  { label: '80×50', w: 80, h: 50 },
  { label: '100×60', w: 100, h: 60 },
];

const FILE_SIZE_PRESETS = [
  { label: '50 KB', value: 50 },
  { label: '100 KB', value: 100 },
  { label: '200 KB', value: 200 },
  { label: '500 KB', value: 500 },
];

export function RightPanel({ settings, onSettingsChange, selectedFile }: RightPanelProps) {
  const update = (patch: Partial<ProcessingSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  return (
    <div className="right-panel">
      {/* Adjustments */}
      <div className="sidebar-section">
        <div className="sidebar-label">Ajustes</div>
        <div className="slider-group">
          <SliderItem
            label="Espessura da Linha"
            value={settings.lineThickness}
            min={1} max={10} step={1}
            onChange={v => update({ lineThickness: v })}
          />
          <SliderItem
            label="Sensibilidade de Detecção"
            value={settings.detectionSensitivity}
            min={1} max={100} step={1}
            onChange={v => update({ detectionSensitivity: v })}
          />
          <SliderItem
            label="Intensidade de Preenchimento Preto"
            value={settings.blackFillIntensity}
            min={1} max={100} step={1}
            onChange={v => update({ blackFillIntensity: v })}
          />
          <SliderItem
            label="Contraste"
            value={settings.contrast}
            min={50} max={200} step={1}
            onChange={v => update({ contrast: v })}
          />
          <SliderItem
            label="Nitidez"
            value={settings.sharpness}
            min={0} max={100} step={1}
            onChange={v => update({ sharpness: v })}
          />
        </div>
      </div>

      {/* Options */}
      <div className="sidebar-section">
        <div className="sidebar-label">Opções</div>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={settings.removeBackground}
            onChange={e => update({ removeBackground: e.target.checked })}
          />
          <span className="checkbox-label">Remover Fundo</span>
        </label>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={settings.solidifyDarkAreas}
            onChange={e => update({ solidifyDarkAreas: e.target.checked })}
          />
          <span className="checkbox-label">Solidificar Áreas Escuras</span>
        </label>
      </div>

      {/* Argox */}
      <div className="sidebar-section">
        <div className="sidebar-label">Impressão Térmica Argox</div>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={settings.argoxMode}
            onChange={e => update({ argoxMode: e.target.checked })}
          />
          <span className="checkbox-label">Ativar Modo Argox</span>
        </label>
        {settings.argoxMode && (
          <>
            <div className="select-group" style={{ marginTop: 8 }}>
              <label className="slider-label">DPI</label>
              <select
                value={settings.argoxDpi}
                onChange={e => update({ argoxDpi: Number(e.target.value) as 203 | 300 })}
              >
                <option value={203}>203 DPI</option>
                <option value={300}>300 DPI</option>
              </select>
            </div>
            <div className="input-row" style={{ marginTop: 8 }}>
              <div className="input-field">
                <label>Largura (mm)</label>
                <input
                  type="number"
                  value={settings.argoxMaxWidth}
                  onChange={e => update({ argoxMaxWidth: Number(e.target.value) })}
                />
              </div>
              <div className="input-field">
                <label>Altura (mm)</label>
                <input
                  type="number"
                  value={settings.argoxMaxHeight}
                  onChange={e => update({ argoxMaxHeight: Number(e.target.value) })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Output Size */}
      <div className="sidebar-section">
        <div className="sidebar-label">Tamanho de Saída</div>
        <div className="size-presets">
          <div
            className={`size-preset ${settings.outputSize === null ? 'active' : ''}`}
            onClick={() => update({ outputSize: null })}
          >
            Original
          </div>
          {SIZE_PRESETS.map(p => (
            <div
              key={p.label}
              className={`size-preset ${
                settings.outputSize?.width === p.w && settings.outputSize?.height === p.h ? 'active' : ''
              }`}
              onClick={() => update({ outputSize: { width: p.w, height: p.h } })}
            >
              {p.label}mm
            </div>
          ))}
        </div>
      </div>

      {/* Max File Size */}
      <div className="sidebar-section">
        <div className="sidebar-label">Tamanho Máximo do Arquivo</div>
        <div className="filesize-options">
          <div
            className={`size-preset ${settings.maxFileSize === null ? 'active' : ''}`}
            onClick={() => update({ maxFileSize: null })}
          >
            Sem Limite
          </div>
          {FILE_SIZE_PRESETS.map(p => (
            <div
              key={p.value}
              className={`size-preset ${settings.maxFileSize === p.value ? 'active' : ''}`}
              onClick={() => update({ maxFileSize: p.value })}
            >
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* File Info */}
      {selectedFile && (
        <div className="sidebar-section">
          <div className="sidebar-label">Arquivo Selecionado</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
            {selectedFile.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            {selectedFile.extension.toUpperCase().slice(1)}
            {selectedFile.size > 0 && ` • ${formatSize(selectedFile.size)}`}
          </div>
        </div>
      )}
    </div>
  );
}

function SliderItem({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-item">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
