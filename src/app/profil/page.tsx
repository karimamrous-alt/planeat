'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, CUISINE_CONFIG } from '@/lib/utils'
import type { Famille, Membre, NiveauEpices } from '@/lib/types'

const NIVEAUX_EPICES: NiveauEpices[] = ['doux', 'moyen', 'fort']
const EPICES_LABELS: Record<NiveauEpices, string> = { doux: '🌿 Doux', moyen: '🌶 Moyen', fort: '🔥 Fort' }

export default function ProfilFamille() {
  const [famille, setFamille]     = useState<Famille | null>(null)
  const [membres, setMembres]     = useState<Membre[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [savedOk, setSavedOk]     = useState(false)
  const [editFam, setEditFam]     = useState(false)
  const [famNom, setFamNom]       = useState('')
  const [famNbP, setFamNbP]       = useState(6)
  const [famRegime, setFamRegime] = useState('halal')

  useEffect(() => {
    const load = async () => {
      const [{ data: fam }, { data: mems }] = await Promise.all([
        supabase.from('familles').select('*').eq('id', FAMILLE_ID).single(),
        supabase.from('membres').select('*').eq('famille_id', FAMILLE_ID).order('created_at'),
      ])
      if (fam) {
        setFamille(fam)
        setFamNom(fam.nom)
        setFamNbP(fam.nb_personnes)
        setFamRegime(fam.regime)
      }
      setMembres(mems ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const sauvegarderFamille = async () => {
    setSaving(true)
    await supabase.from('familles').update({ nom: famNom, nb_personnes: famNbP, regime: famRegime }).eq('id', FAMILLE_ID)
    setFamille(prev => prev ? { ...prev, nom: famNom, nb_personnes: famNbP, regime: famRegime } : prev)
    setEditFam(false)
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2500)
    setSaving(false)
  }

  const mettreAJourMembre = async (id: string, patch: Partial<Membre>) => {
    setMembres(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
    await supabase.from('membres').update(patch).eq('id', id)
  }

  const ajouterMembre = async () => {
    const { data } = await supabase
      .from('membres')
      .insert({ famille_id: FAMILLE_ID, prenom: 'Nouveau', age: null, restrictions: [], preferences: [], niveau_epices: 'moyen', portions: 1.0 })
      .select('*').single()
    if (data) setMembres(prev => [...prev, data])
  }

  const supprimerMembre = async (id: string) => {
    await supabase.from('membres').delete().eq('id', id)
    setMembres(prev => prev.filter(m => m.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48"><div className="spinner text-green-700" /></div>
  )

  return (
    <div className="fade-in space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👨‍👩‍👧‍👦 Profil famille</h1>
          <p className="text-gray-500 text-sm mt-0.5">{membres.length} membres · Régime {famille?.regime ?? '—'}</p>
        </div>
        {savedOk && <span className="text-green-600 text-sm font-medium">✅ Sauvegardé !</span>}
      </div>

      {/* Carte famille */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-700">Informations générales</h2>
          {!editFam ? (
            <button onClick={() => setEditFam(true)} className="text-sm text-green-700 hover:text-green-900 font-medium">Modifier</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditFam(false)} className="text-sm text-gray-500 hover:text-gray-700">Annuler</button>
              <button onClick={sauvegarderFamille} disabled={saving} className="text-sm bg-green-700 text-white px-3 py-1 rounded-lg hover:bg-green-800 disabled:opacity-50">
                {saving ? <span className="spinner" style={{width:'0.8rem',height:'0.8rem'}} /> : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        {editFam ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom de famille</label>
              <input
                value={famNom}
                onChange={e => setFamNom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre de personnes</label>
              <input
                type="number" min={1} max={20}
                value={famNbP}
                onChange={e => setFamNbP(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Régime</label>
              <select
                value={famRegime}
                onChange={e => setFamRegime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {['halal', 'vegetarien', 'vegan', 'standard'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Nom', value: famille?.nom ?? '—' },
              { label: 'Personnes', value: famille?.nb_personnes ?? '—' },
              { label: 'Régime', value: famille?.regime ?? '—' },
              { label: 'Membres inscrits', value: membres.length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="font-bold text-gray-800 capitalize">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cuisines */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-700 mb-4">Cuisines favorites</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CUISINE_CONFIG).map(([cuisine, cfg]) => (
            <span key={cuisine} className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-sm font-medium ${cfg.bgClass} ${cfg.colorClass}`}>
              <span className="text-lg">{cfg.emoji}</span>
              <span className="capitalize">{cuisine}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Restrictions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-700 mb-4">Restrictions alimentaires</h2>
        <div className="flex flex-wrap gap-2">
          {['Sans porc', 'Sans alcool', 'Sans abats', 'Sans fruits de mer', 'Sans agneau'].map(r => (
            <span key={r} className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium">
              🚫 {r}
            </span>
          ))}
        </div>
      </div>

      {/* Membres */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-700">Membres ({membres.length})</h2>
          <button onClick={ajouterMembre} className="text-sm bg-green-700 text-white px-4 py-2 rounded-xl hover:bg-green-800 transition-colors font-medium">
            + Ajouter
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {membres.map(m => (
            <MembreCard
              key={m.id}
              membre={m}
              onUpdate={patch => mettreAJourMembre(m.id, patch)}
              onDelete={() => supprimerMembre(m.id)}
            />
          ))}
        </div>

        {membres.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-gray-400">Aucun membre enregistré.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MembreCard({ membre, onUpdate, onDelete }: {
  membre: Membre
  onUpdate: (patch: Partial<Membre>) => void
  onDelete: () => void
}) {
  const [editing, setEditing]   = useState(false)
  const [prenom, setPrenom]     = useState(membre.prenom)
  const [age, setAge]           = useState<string>(membre.age != null ? String(membre.age) : '')
  const [epices, setEpices]     = useState<NiveauEpices>(membre.niveau_epices)
  const [portions, setPortions] = useState<string>(String(membre.portions))

  const save = () => {
    onUpdate({ prenom, age: age ? Number(age) : null, niveau_epices: epices, portions: Number(portions) || 1 })
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        {editing ? (
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            className="font-bold text-gray-800 border-b border-green-400 focus:outline-none text-base flex-1 mr-2"
            autoFocus
          />
        ) : (
          <h3 className="font-bold text-gray-800">{membre.prenom}</h3>
        )}
        <div className="flex gap-1">
          {editing ? (
            <>
              <button onClick={save} className="text-xs bg-green-700 text-white px-2 py-1 rounded-lg hover:bg-green-800">OK</button>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-green-700 transition-colors" title="Modifier">✏️</button>
              <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 transition-colors" title="Supprimer">🗑</button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-16">Âge</span>
          {editing ? (
            <input
              type="number" min={0} max={120}
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="—"
              className="border border-gray-200 rounded px-2 py-0.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-green-400"
            />
          ) : (
            <span className="text-gray-700">{membre.age != null ? `${membre.age} ans` : '—'}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-16">Épices</span>
          {editing ? (
            <select
              value={epices}
              onChange={e => setEpices(e.target.value as NiveauEpices)}
              className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
            >
              {NIVEAUX_EPICES.map(n => <option key={n} value={n}>{EPICES_LABELS[n]}</option>)}
            </select>
          ) : (
            <span className="text-gray-700">{EPICES_LABELS[membre.niveau_epices]}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-16">Portions</span>
          {editing ? (
            <select
              value={portions}
              onChange={e => setPortions(e.target.value)}
              className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
            >
              {['0.5', '0.8', '1.0', '1.2', '1.5'].map(v => <option key={v} value={v}>{v}×</option>)}
            </select>
          ) : (
            <span className="text-gray-700">{membre.portions}×</span>
          )}
        </div>

        {membre.restrictions?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {membre.restrictions.map(r => (
              <span key={r} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>
        )}

        {membre.preferences?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {membre.preferences.map(p => (
              <span key={p} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{p}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
