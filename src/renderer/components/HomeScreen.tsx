import React from 'react';

interface HomeScreenProps {
  onSelectModule: (module: 'shoe' | 'pdf' | 'image') => void;
}

export function HomeScreen({ onSelectModule }: HomeScreenProps) {
  return (
    <div className="home-screen">
      <div className="home-header">
        <img src="img/logo.png" alt="Logo" className="home-logo" />
        <h1 className="home-title">Conversor de Imagens</h1>
        <p className="home-subtitle">Desenvolvido por Gustavo Fraga</p>
      </div>

      <div className="home-modules">
        <div className="home-card" onClick={() => onSelectModule('shoe')}>
          <div className="home-card-icon">🖼️</div>
          <h2 className="home-card-title">Conversor de Calçados</h2>
          <p className="home-card-desc">
            Transforme fotos de calçados em desenhos técnicos preto e branco para impressão Argox.
          </p>
        </div>

        <div className="home-card" onClick={() => onSelectModule('pdf')}>
          <div className="home-card-icon">📑</div>
          <h2 className="home-card-title">Juntar PDFs</h2>
          <p className="home-card-desc">
            Selecione vários arquivos PDF e combine-os em um único documento.
          </p>
        </div>

        <div className="home-card" onClick={() => onSelectModule('image')}>
          <div className="home-card-icon">🔄</div>
          <h2 className="home-card-title">Converter Imagens</h2>
          <p className="home-card-desc">
            Converta imagens entre formatos: JPEG, PNG, WEBP, BMP, TIFF e outros.
          </p>
        </div>
      </div>

      <div className="home-footer">
        © 2024 Gustavo Fraga - Todos os direitos reservados
      </div>
    </div>
  );
}
