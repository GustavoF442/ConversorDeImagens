import React, { useState } from 'react';
import { ProcessingSettings, FileInfo } from '../types';

interface RightPanelProps {
  settings: ProcessingSettings;
  onSettingsChange: (settings: ProcessingSettings) => void;
  selectedFile: FileInfo | null;
}

const SIZE_PRESETS = [
  { label: 'Original', w: null, h: null },
  { label: '50×50', w: 50, h: 50 },
  { label: '60×40', w: 60, h: 40 },
  { label: '80×50', w: 80, h: 50 },
  { label: '100×60', w: 100, h: 60 },
];

const FILE_SIZE_PRESETS = [
  { label: 'Sem Limite', value: null },
  { label: '50 KB', value: 50 },
  { label: '100 KB', value: 100 },
  { label: '200 KB', value: 200 },
  { label: '500 KB', value: 500 },
];

export function RightPanel({ settings, onSettingsChange, selectedFile }: RightPanelProps) {
  const update = (patch: Partial<ProcessingSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  return (
    <div className="right-panel">
      <div className="right-panel-header">Configurações</div>

      <ConfigCard icon="🔍" title="Detecção" defaultOpen>
        <div className="slider-group">
          <Slider label="Sensibilidade" hint="Threshold do detector de bordas"
            value={settings.detectionSensitivity} min={1} max={100}
            onChange={v => update({ detectionSensitivity: v })} />
          <Slider label="Contraste (CLAHE)" hint="Equalização adaptativa local"
            value={settings.contrast} min={50} max={200}
            onChange={v => update({ contrast: v })} />
          <Slider label="Nitidez" hint="Unsharp Mask antes da detecção"
            value={settings.sharpness} min={0} max={100}
            onChange={v => update({ sharpness: v })} />
        </div>
      </ConfigCard>

      <ConfigCard icon="✏️" title="Contornos" defaultOpen>
        <div className="slider-group">
          <Slider label="Espessura da Linha" hint="Dilatação morfológica dos contornos"
            value={settings.lineThickness} min={1} max={10}
            onChange={v => update({ lineThickness: v })} />
        </div>
      </ConfigCard>

      <ConfigCard icon="🎨" title="Preenchimento">
        <div className="slider-group">
          <Slider label="Intensidade de Preenchimento" hint="Threshold para áreas escuras sólidas"
            value={settings.blackFillIntensity} min={1} max={100}
            onChange={v => update({ blackFillIntensity: v })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Toggle
            label="Remover Fundo"
            desc="Segmentação do produto"
            checked={settings.removeBackground}
            onChange={v => update({ removeBackground: v })}
          />
          <Toggle
            label="Solidificar Áreas Escuras"
            desc="Fechamento morfológico"
            checked={settings.solidifyDarkAreas}
            onChange={v => update({ solidifyDarkAreas: v })}
          />
        </div>
      </ConfigCard>

      <ConfigCard icon="🖨️" title="Argox">
        <Toggle
          label="Modo Argox"
          desc="Impressão térmica 1-bit"
          checked={settings.argoxMode}
          onChange={v => update({ argoxMode: v })}
        />
        {settings.argoxMode && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="select-group">
              <span className="slider-label">Resolução</span>
              <select
                value={settings.argoxDpi}
                onChange={e => update({ argoxDpi: Number(e.target.value) as 203 | 300 })}
                style={{ marginTop: 4 }}
              >
                <option value={203}>203 DPI</option>
                <option value={300}>300 DPI</option>
              </select>
            </div>
            <div className="input-row">
              <div className="input-field">
                <label>Largura (mm)</label>
                <input type="number" value={settings.argoxMaxWidth}
                  onChange={e => update({ argoxMaxWidth: Number(e.target.value) })} />
              </div>
              <div className="input-field">
                <label>Altura (mm)</label>
                <input type="number" value={settings.argoxMaxHeight}
                  onChange={e => update({ argoxMaxHeight: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        )}
      </ConfigCard>

      <ConfigCard icon="📐" title="Tamanho de Saída">
        <div className="size-presets">
          {SIZE_PRESETS.map(p => (
            <div
              key={p.label}
              className={`size-preset ${
                p.w === null
                  ? settings.outputSize === null ? 'active' : ''
                  : settings.outputSize?.width === p.w && settings.outputSize?.height === p.h ? 'active' : ''
              }`}
              onClick={() => update({ outputSize: p.w ? { width: p.w, height: p.h! } : null })}
            >
              {p.label}{p.w ? ' mm' : ''}
            </div>
          ))}
        </div>
      </ConfigCard>

      <ConfigCard icon="💾" title="Tamanho Máximo">
        <div className="filesize-options">
          {FILE_SIZE_PRESETS.map(p => (
            <div
              key={String(p.value)}
              className={`size-preset ${settings.maxFileSize === p.value ? 'active' : ''}`}
              onClick={() => update({ maxFileSize: p.value })}
            >
              {p.label}
            </div>
          ))}
        </div>
      </ConfigCard>

      {selectedFile && (
        <ConfigCard icon="📁" title="Arquivo">
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.6 }}>
            {selectedFile.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8 }}>
            <span style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>
              {selectedFile.extension.toUpperCase().slice(1)}
            </span>
            {selectedFile.size > 0 && (
              <span style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>
                {formatSize(selectedFile.size)}
              </span>
            )}
          </div>
        </ConfigCard>
      )}

      <div style={{ height: 16 }} />
    </div>
  );
}

function ConfigCard({
  icon, title, children, defaultOpen = false,
}: {
  icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="config-card">
      <div className="config-card-header" onClick={() => setOpen(!open)}>
        <span className="config-card-icon">{icon}</span>
        <span className="config-card-title">{title}</span>
        <svg className={`config-card-chevron ${open ? 'open' : ''}`} width="14" height="14"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && <div className="config-card-body">{children}</div>}
    </div>
  );
}

function Slider({
  label, hint, value, min, max, step = 1, onChange,
}: {
  label: string; hint?: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-item">
      <div className="slider-header">
        <div>
          <div className="slider-label">{label}</div>
          {hint && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</div>}
        </div>
        <span className="slider-value">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({
  label, desc, checked, onChange,
}: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="checkbox-item" style={{ alignItems: 'flex-start', paddingBottom: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2 }} />
      <div>
        <div className="checkbox-label">{label}</div>
        {desc && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</div>}
      </div>
    </label>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
