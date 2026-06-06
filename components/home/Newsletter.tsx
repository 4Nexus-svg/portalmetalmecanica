export default function Newsletter() {
  return (
    <div className="bg-[#1A2B4A] rounded-xl p-5 text-white">
      <h3 className="font-bold text-lg mb-1">Newsletter</h3>
      <p className="text-blue-200 text-sm mb-4">Receba as principais notícias industriais toda semana.</p>
      <input type="email" placeholder="seu@email.com" className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm mb-2 focus:outline-none" />
      <button className="w-full bg-[#C9A84C] text-white font-bold py-2 rounded-lg hover:bg-[#b8973e] transition-colors text-sm">Inscrever-se</button>
    </div>
  );
}
