const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// codex.cmd não é um executável nativo — no Windows precisa passar por um shell,
// e execFileSync com shell:true não escapa os args automaticamente. Monta o
// comando via execSync com o prompt escapado manualmente pra aspas duplas do cmd.exe.
function rodarCodex(prompt, { cwd, timeout }) {
  const promptEscapado = prompt.replace(/"/g, '""');
  return execSync(`codex.cmd exec --skip-git-repo-check "${promptEscapado}"`, {
    cwd, encoding: 'utf8', timeout, input: '',
  });
}

// Decide se a foto de uma matéria é uma ARTE (flyer/cartaz/banner com texto embutido,
// onde cortar/blur a borda perderia informação) ou uma FOTO real (paisagem, pessoas,
// objeto, cena) — e só aplica outpaint via IA no primeiro caso. Foto real mantém o
// comportamento padrão (corte simples/cover no template, sem custo de geração de imagem).

function classificar(fotoPath) {
  const dir = path.dirname(fotoPath);
  const nome = path.basename(fotoPath);
  const prompt = `Look at the local image file '${nome}' in the current directory. Classify it as exactly one of these two words, output ONLY that single word on the last line, nothing else: GRAFICO (if it is a designed graphic/flyer/poster/banner with overlaid text, logos, flat color blocks, made in a design tool) or FOTO (if it is a real photograph of a place, people, object, or scene, even if the photo itself contains a screen, sign, or text visible within the scene).`;

  const out = rodarCodex(prompt, { cwd: dir, timeout: 90000 });

  const linhas = out.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const ultima = linhas[linhas.length - 1] || '';
  if (/GRAFICO/i.test(ultima)) return 'arte';
  if (/FOTO/i.test(ultima)) return 'foto';
  // fallback conservador: se a classificação vier ambígua, trata como foto
  // (comportamento atual, mais barato e seguro) em vez de arriscar um outpaint desnecessário
  console.warn('classificarImagem: resposta ambígua, assumindo "foto". Saída bruta:', ultima);
  return 'foto';
}

function outpaint({ fotoPath, aspecto, outPath }) {
  const dir = path.dirname(fotoPath);
  const nome = path.basename(fotoPath);
  const [w, h] = aspecto === '9:16' ? [1080, 1920] : [1080, 1350];
  const prompt = `Use the image_gen tool to EDIT the local image '${nome}' (a course/event flyer or poster design). Outpaint it to a ${aspecto === '9:16' ? '9:16 vertical' : '4:5 portrait'} canvas (${w}x${h}). Keep the entire original flyer content pixel-identical, uncropped, centered horizontally. Do NOT leave large flat plain empty areas top and bottom looking like padding. Actively DESIGN the extended top and bottom areas as a continuation of this poster's own visual language: continue and enlarge any diagonal shapes, gradients, and dot/halftone pattern textures already visible in the source so they flow naturally into the new space, like the design was always this size. The added regions must look like intentional graphic design elements of the SAME poster, not empty padding. No new text, no new logos, no photographic content — just the extended flat graphic design elements (shapes, dots, gradients) in the same style. Save the resulting PNG.`;

  const before = new Set(listarPngsGerados());
  rodarCodex(prompt, { cwd: dir, timeout: 280000 });
  const depois = listarPngsGerados();
  const novos = depois.filter((p) => !before.has(p)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (novos.length === 0) throw new Error('outpaint: nenhum PNG novo encontrado após rodar codex');

  fs.copyFileSync(novos[0], outPath);
  return outPath;
}

function listarPngsGerados() {
  const base = path.join(require('os').homedir(), '.codex', 'generated_images');
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const sessao of fs.readdirSync(base)) {
    const dir = path.join(base, sessao);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.png')) out.push(path.join(dir, f));
    }
  }
  return out;
}

/**
 * Prepara a foto pro template: se for arte/flyer, faz outpaint pro aspecto alvo e
 * retorna o novo caminho; se for foto real, retorna o caminho original sem alterar
 * (o template já resolve com corte/cover).
 */
function prepararFoto({ fotoPath, aspecto }) {
  const tipo = classificar(fotoPath);
  console.log(`classificarImagem: "${path.basename(fotoPath)}" -> ${tipo}`);
  if (tipo === 'foto') {
    return { fotoPath, tipo };
  }
  const outPath = fotoPath.replace(/\.\w+$/, '') + '-outpaint.png';
  outpaint({ fotoPath, aspecto, outPath });
  return { fotoPath: outPath, tipo };
}

module.exports = { classificar, outpaint, prepararFoto };
