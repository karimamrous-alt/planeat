import Link from 'next/link'

const fonctionnalites = [
  {
    href: '/profil',
    icone: '👨‍👩‍👧‍👦',
    titre: 'Profil famille',
    description: 'Gérez les membres de votre famille, leurs préférences alimentaires et leurs allergies.',
    couleur: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    texteCouleur: 'text-blue-700',
  },
  {
    href: '/menus',
    icone: '📅',
    titre: 'Génération de menus',
    description: 'Générez des menus équilibrés pour la semaine adaptés aux goûts de toute la famille.',
    couleur: 'bg-green-50 border-green-200 hover:bg-green-100',
    texteCouleur: 'text-green-700',
  },
  {
    href: '/courses',
    icone: '🛒',
    titre: 'Liste de courses',
    description: 'Obtenez automatiquement votre liste de courses basée sur les menus planifiés.',
    couleur: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    texteCouleur: 'text-orange-700',
  },
  {
    href: '/favoris',
    icone: '❤️',
    titre: 'Plats favoris',
    description: 'Retrouvez et gérez tous les plats préférés de votre famille.',
    couleur: 'bg-red-50 border-red-200 hover:bg-red-100',
    texteCouleur: 'text-red-700',
  },
]

export default function Accueil() {
  return (
    <div>
      {/* Hero */}
      <section className="text-center py-12">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Bienvenue sur <span className="text-green-700">PlanEat</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
          Simplifiez la planification des repas de votre famille. Générez des menus équilibrés,
          créez vos listes de courses et gardez une trace de vos plats préférés.
        </p>
        <Link
          href="/menus"
          className="inline-flex items-center gap-2 bg-green-700 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-800 transition-colors"
        >
          <span>📅</span>
          Planifier mes menus
        </Link>
      </section>

      {/* Fonctionnalités */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">
          Tout ce dont vous avez besoin
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fonctionnalites.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={`block border rounded-2xl p-6 transition-colors ${f.couleur}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl">{f.icone}</span>
                <div>
                  <h3 className={`text-lg font-bold mb-2 ${f.texteCouleur}`}>{f.titre}</h3>
                  <p className="text-gray-600 text-sm">{f.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Astuce du jour */}
      <section className="mt-10 bg-green-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">💡</span>
          <h3 className="text-lg font-bold text-green-700">Le saviez-vous ?</h3>
        </div>
        <p className="text-gray-600">
          Planifier ses repas à l&apos;avance permet de réduire le gaspillage alimentaire jusqu&apos;à 40 %
          et d&apos;économiser en moyenne 200 € par mois par famille.
        </p>
      </section>
    </div>
  )
}
