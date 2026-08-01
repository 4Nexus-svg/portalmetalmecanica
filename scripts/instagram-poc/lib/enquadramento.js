// Descobre o ponto focal da foto (rosto) para o corte das artes do Instagram.
//
// Portado do pipeline do CongressoAqui (2026-07-31). As artes cortam a foto da
// materia para 4:5 (feed) e 9:16 (story) com object-fit: cover. Com
// object-position: center, foto cujo rosto nao esta no centro geometrico sai
// cortada na testa/queixo. Aqui delegamos a deteccao para lib/detectar-rosto.py
// (Pillow + numpy, sem dependencia nova de Node) e devolvemos um
// object-position em porcentagem.
//
// NUNCA lanca: se Python/lib faltar, ou se a foto nao tiver rosto (grafico,
// maquina, fachada de fabrica), volta para 'center' — o comportamento anterior.
// Isso importa aqui mais que no CongressoAqui: a maior parte das fotos do
// Metalmecanica e industrial, sem pessoa, e vai cair no fallback.
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'detectar-rosto.py');
const PYTHONS = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];

// Limita o quanto o corte pode fugir do centro. Sem isso, uma deteccao ruim
// jogaria o enquadramento para a borda e cortaria pior que o padrao.
const MIN = 0.15;
const MAX = 0.85;

function clamp(v) {
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(MAX, Math.max(MIN, v));
}

function detectarFoco(fotoPath) {
  for (const py of PYTHONS) {
    try {
      const out = execFileSync(py, [SCRIPT, path.resolve(fotoPath)], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 25000,
      }).trim();
      if (!out) continue;
      const r = JSON.parse(out);
      if (r && r.ok) {
        return { ok: true, x: clamp(r.focoX), y: clamp(r.focoY), blobs: r.blobs, metodo: r.metodo };
      }
      // python respondeu, mas nao achou rosto: nao adianta tentar outro binario
      return { ok: false, motivo: (r && (r.motivo || r.erro)) || 'sem rosto detectado' };
    } catch {
      // binario ausente/erro: tenta o proximo
    }
  }
  return { ok: false, motivo: 'python indisponivel' };
}

// object-position pronto para o CSS; 'center' quando nao ha deteccao confiavel.
function objectPosition(fotoPath) {
  const f = detectarFoco(fotoPath);
  if (!f.ok) return { valor: 'center', deteccao: f };
  return {
    valor: `${(f.x * 100).toFixed(1)}% ${(f.y * 100).toFixed(1)}%`,
    deteccao: f,
  };
}

module.exports = { detectarFoco, objectPosition };
