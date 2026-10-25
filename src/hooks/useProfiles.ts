import { useState, useEffect, useCallback } from 'react';
import { SavedProfile, getProfiles, saveProfile, updateProfile as overwriteProfile, deleteProfile as removeProfile, toggleFavorite } from '../lib/profileStorage';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);

  const refreshProfiles = useCallback(() => {
    setProfiles(getProfiles());
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const addProfile = useCallback((name: string, type: 'tube' | 'pan' | 'handle', data: any) => {
    let finalName = name;
    
    // Algorithm check: Ensure unique name within the same type and classification (Unique / Parametric)
    const existingProfiles = getProfiles();
    const isIncomingUnique = !!data?.isUnique;
    
    let counter = 1;
    while (existingProfiles.some(p => p.type === type && !!p.data?.isUnique === isIncomingUnique && p.name === finalName)) {
      finalName = `${name} (${counter})`;
      counter++;
    }

    const newProfile: SavedProfile = {
      id: Math.random().toString(36).substring(2, 9),
      name: finalName,
      type,
      data,
      createdAt: Date.now(),
    };
    saveProfile(newProfile);
    refreshProfiles();
  }, [refreshProfiles]);

  const updateProfile = useCallback((id: string, name: string, data: any) => {
    overwriteProfile(id, name, data);
    refreshProfiles();
  }, [refreshProfiles]);

  const deleteProfile = useCallback((id: string) => {
    removeProfile(id);
    refreshProfiles();
  }, [refreshProfiles]);

  const toggleProfileFavorite = useCallback((id: string, isFavorite: boolean) => {
    toggleFavorite(id, isFavorite);
    refreshProfiles();
  }, [refreshProfiles]);

  return { profiles, addProfile, updateProfile, deleteProfile, toggleProfileFavorite, refreshProfiles };
};
