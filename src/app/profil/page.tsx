'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, CUISINE_CONFIG } from '@/lib/utils'
import type { Famille, Membre } from '@/lib/types'

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
        setFamRegime(fam.preferences?.regime ?? 'halal')
      }
      setMembres(mems ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const sauvegarderFamille = async () => {
    setSaving(true)
    await supabase.from('familles').update({
      nom: famNom,
      nb_personnes: famNbP,
      preferences: { ...(famille?.preferences ?? {}), regime: famRegime },
    }).eq('id', FAMILLE_ID)
    setFamille(prev => prev ? { ...prev, nom: famNom, nb_personnes: famNbP, preferences: { ...(prev.preferences ?? {}), regime: famRegime } } : prev)
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
      .insert({ famille_id: FAMILLE_ID, prenom: 'Nouveau', age: null, restrictions: [] })
      .select('*').single()
    if (data) setMembres(prev => [...prev, data])
  }

  const supprimerMembre = async (id: string) => {
    await supabase.from('membres').delete().eq('id', id)
    setMembres(prev => prev.filter(m => m.id !== id))
  }

  if (loading) return (
    <div className="flex justify-center h-48 items-center">
      <div className="spinner" style={{ color: '#E8622A' }} />
    </div>
  )

  const inputClass = "w-full rounded-2xl px-4 py-3 text-sm focus:outline-none border"
  const inputStyle = { borderColor: '#F0E6DC', color: '#2C1810', background: '#FDF6F0' }

  return (
    <div className="fade-in space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#2C1810' }}>👨‍👩‍👧‍👦 Profil famille</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B5E3C' }}>
            {membres.length} membres · Régime {famille?.preferences?.regime ?? '—'}
          </p>
        </div>
        {savedOk && (
          <span className="text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: '#E8622A', color: '#fff' }}>
            ✅ Sauvegardé !
          </span>
        )}
      </div>

      {/* Carte famille */}
      <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base" style={{ color: '#2C1810' }}>Informations générales</h2>
          {!editFam ? (
            <button onClick={() => setEditFam(true)}
              className="text-sm font-bold px-3 py-1.5 rounded-full border transition-colors hover:opacity-80"
              style={{ color: '#E8622A', borderColor: '#E8622A' }}>
              Modifier
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditFam(false)}
                className="text-sm px-3 py-1.5 rounded-full border transition-colors"
                style={{ color: '#8B5E3C', borderColor: '#F0E6DC' }}>
                Annuler
              </button>
              <button onClick={sauvegarderFamille} disabled={saving}
                className="text-sm px-4 py-1.5 rounded-full font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-80"
                style={{ background: '#E8622A' }}>
                {saving ? <span className="spinner" style={{ width: '0.8rem', height: '0.8rem' }} /> : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        {editFam ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: '#8B5E3C' }}>Nom de famille</label>
              <input value={famNom} onChange={e => setFamNom(e.target.value)}
                className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: '#8B5E3C' }}>Nombre de personnes</label>
              <input type="number" min={1} max={20} value={famNbP} onChange={e => setFamNbP(Number(e.target.value))}
                className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: '#8B5E3C' }}>Régime</label>
              <select value={famRegime} onChange={e => setFamRegime(e.target.value)}
                className={inputClass} style={inputStyle}>
                {['halal', 'vegetarien', 'vegan', 'standard'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Nom',             value: famille?.nom ?? '—',                  emoji: '🏠' },
              { label: 'Personnes',       value: famille?.nb_personnes ?? '—',          emoji: '👥' },
              { label: 'Régime',          value: famille?.preferences?.regime ?? '—',  emoji: '🍽️' },
              { label: 'Membres',         value: membres.length,                        emoji: '👤' },
            ].map(({ label, value, emoji }) => (
              <div key={label} className="rounded-2xl p-3 text-center" style={{ background: '#FDF6F0' }}>
                <p className="text-xl mb-1">{emoji}</p>
                <p className="font-bold text-base capitalize" style={{ color: '#2C1810' }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#8B5E3C' }}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cuisines */}
      <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <h2 className="font-display font-bold text-base mb-4" style={{ color: '#2C1810' }}>Cuisines disponibles</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CUISINE_CONFIG).map(([cuisine, cfg]) => (
            <span key={cuisine} className={`flex items-center gap-2 border rounded-2xl px-4 py-2 text-sm font-bold ${cfg.bgClass} ${cfg.colorClass}`}>
              <span className="text-xl">{cfg.emoji}</span>
              <span className="capitalize">{cuisine}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Restrictions */}
      <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <h2 className="font-display font-bold text-base mb-4" style={{ color: '#2C1810' }}>Restrictions alimentaires</h2>
        <div className="flex flex-wrap gap-2">
          {['Sans porc', 'Sans alcool', 'Sans abats', 'Sans fruits de mer'].map(r => (
            <span key={r} className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full font-bold">
              🚫 {r}
            </span>
          ))}
        </div>
      </div>

      {/* Membres */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base" style={{ color: '#2C1810' }}>Membres ({membres.length})</h2>
          <button onClick={ajouterMembre}
            className="text-sm font-bold text-white px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{ background: '#E8622A' }}>
            + Ajouter
          </button>
        </div>

        {membres.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
            <p className="text-5xl mb-3">👤</p>
            <p className="text-sm" style={{ color: '#8B5E3C' }}>Aucun membre enregistré.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {membres.map(m => (
              <MembreCard
                key={m.id}
                membre={m}
                onUpdate={patch => mettreAJourMembre(m.id, patch)}
                onDelete={() => supprimerMembre(m.id)}
              />
            ))}
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
  const [editing, setEditing] = useState(false)
  const [prenom, setPrenom]   = useState(membre.prenom)
  const [age, setAge]         = useState<string>(membre.age != null ? String(membre.age) : '')

  const save = () => {
    onUpdate({ prenom, age: age ? Number(age) : null })
    setEditing(false)
  }

  // Avatar color based on first letter
  const colors = ['#E8622A', '#F5A623', '#4CAF50', '#3B82F6', '#8B5CF6', '#EC4899']
  const colorIdx = membre.prenom.charCodeAt(0) % colors.length

  return (
    <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
          style={{ background: colors[colorIdx] }}>
          {membre.prenom.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input value={prenom} onChange={e => setPrenom(e.target.value)}
              className="font-bold w-full border-b-2 focus:outline-none text-base"
              style={{ borderColor: '#E8622A', color: '#2C1810' }} autoFocus />
          ) : (
            <h3 className="font-bold text-base" style={{ color: '#2C1810' }}>{membre.prenom}</h3>
          )}
          <p className="text-xs" style={{ color: '#8B5E3C' }}>
            {membre.age != null ? `${membre.age} ans` : 'Âge non renseigné'}
          </p>
        </div>
        <div className="flex gap-1">
          {editing ? (
            <>
              <button onClick={save}
                className="text-xs font-bold text-white px-2.5 py-1 rounded-full"
                style={{ background: '#E8622A' }}>OK</button>
              <button onClick={() => setEditing(false)}
                className="text-xs px-2 py-1 rounded-full"
                style={{ color: '#8B5E3C' }}>✕</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="text-sm hover:opacity-60 transition-opacity" title="Modifier">✏️</button>
              <button onClick={onDelete}
                className="text-sm hover:opacity-60 transition-opacity" title="Supprimer">🗑</button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2">
          <label className="text-xs font-bold block mb-1" style={{ color: '#8B5E3C' }}>Âge</label>
          <input type="number" min={0} max={120} value={age} onChange={e => setAge(e.target.value)}
            placeholder="—"
            className="w-20 border rounded-xl px-3 py-1.5 text-sm focus:outline-none"
            style={{ borderColor: '#F0E6DC', color: '#2C1810', background: '#FDF6F0' }} />
        </div>
      )}

      {membre.restrictions?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t" style={{ borderColor: '#F0E6DC' }}>
          {membre.restrictions.map(r => (
            <span key={r} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">{r}</span>
          ))}
        </div>
      )}
    </div>
  )
}
