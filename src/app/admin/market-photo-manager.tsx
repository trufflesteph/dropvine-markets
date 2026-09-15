"use client";

import { useState } from "react";

import SubmitButton from "./submit-button";

type MarketPhoto = { id: string; market_id: string; photo_url: string; sort_order: number };
type Props = {
  marketId: string;
  photos: MarketPhoto[];
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  reorderAction: (formData: FormData) => Promise<void>;
};

export default function MarketPhotoManager({ marketId, photos, uploadAction, deleteAction, reorderAction }: Props) {
  const [orderedPhotos, setOrderedPhotos] = useState(photos);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function movePhoto(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const fromIndex = orderedPhotos.findIndex((photo) => photo.id === draggedId);
    const toIndex = orderedPhotos.findIndex((photo) => photo.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...orderedPhotos];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedPhotos(next);
    setDraggedId(null);
  }

  return <section className="border border-black/10 bg-white/60 p-5">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="font-serif text-2xl">Market photos</h2><p className="mt-1 text-sm text-black/60">Upload multiple images, then drag thumbnails to reorder them.</p></div>
      <span className="text-sm text-black/50">{orderedPhotos.length} {orderedPhotos.length === 1 ? "photo" : "photos"}</span>
    </div>
    <form action={uploadAction} className="mt-5 flex flex-wrap items-end gap-3"><input name="market_id" type="hidden" value={marketId} /><label className="block text-sm"><span>Select images</span><input accept="image/*" className="mt-1 block text-sm" multiple name="photos" type="file" required /></label><button className="bg-black px-3 py-2 text-sm text-white" type="submit">Upload photos</button></form>
    {orderedPhotos.length ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{orderedPhotos.map((photo) => <div draggable key={photo.id} onDragStart={() => setDraggedId(photo.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => movePhoto(photo.id)} className="border border-black/10 bg-[#F2F0EA] p-2"><img src={photo.photo_url} alt="" className="aspect-square w-full object-cover" /><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-black/50">Drag to move</span><form action={deleteAction}><input name="market_id" type="hidden" value={marketId} /><input name="id" type="hidden" value={photo.id} /><SubmitButton className="text-xs text-red-700" pendingLabel="Deleting...">Delete</SubmitButton></form></div></div>)}</div><form action={reorderAction} className="mt-4"><input name="market_id" type="hidden" value={marketId} /><input name="photo_ids" type="hidden" value={JSON.stringify(orderedPhotos.map((photo) => photo.id))} /><SubmitButton className="border border-black/20 px-3 py-2 text-sm" pendingLabel="Saving order...">Save photo order</SubmitButton></form></> : <p className="mt-5 border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/50">No photos uploaded yet.</p>}
  </section>;
}
