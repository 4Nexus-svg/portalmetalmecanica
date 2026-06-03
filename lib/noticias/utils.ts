export async function safeRun<T>(
  fn: () => Promise<T>,
  opts: {
    tentativas?: number;
    delayBase?: number;
    timeout?: number;
    fallback?: T;
  } = {}
): Promise<T> {
  const { tentativas = 3, delayBase = 500, timeout = 15000 } = opts;

  for (let i = 0; i < tentativas; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('safeRun timeout')), timeout)
        ),
      ]);
    } catch {
      if (i === tentativas - 1) {
        if ('fallback' in opts) return opts.fallback as T;
        throw new Error(`safeRun falhou após ${tentativas} tentativas`);
      }
      await new Promise(r => setTimeout(r, delayBase * (i + 1)));
    }
  }
  throw new Error('safeRun: unreachable');
}

export async function processarComConcorrencia<T>(
  itens: T[],
  fn: (item: T) => Promise<void>,
  concorrencia = 3
): Promise<void> {
  const queue = [...itens];
  const workers = Array.from(
    { length: Math.min(concorrencia, queue.length || 1) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) await fn(item).catch(() => {});
      }
    }
  );
  await Promise.all(workers);
}

export function slugifyTitulo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export function normT(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
