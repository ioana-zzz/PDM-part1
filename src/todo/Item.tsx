import React, { useRef, useEffect, useMemo } from 'react';
import { 
  IonItem, 
  IonLabel, 
  IonThumbnail, 
  IonIcon, 
  createAnimation 
} from '@ionic/react';
import type { Animation } from '@ionic/core';
import { imageOutline, mapOutline } from 'ionicons/icons';
import { ItemProps } from './ItemProps';
import { getLogger } from '../core';
import { baseUrl } from '../core'; 

const log = getLogger('Item');

interface ItemPropsWithEdit extends ItemProps {
  onEdit: (id: string) => void;
}

const Item: React.FC<ItemPropsWithEdit> = ({
  _id,
  name,
  photoPath,
  date_visited,
  onEdit,
  tempId,
  _pendingSync,
  _photoPendingSync
}) => {
  
  const itemRef = useRef<HTMLIonItemElement>(null);
  const animationRef = useRef<Animation | null>(null);

  const handleEdit = () => {
    onEdit(_id || tempId || ''); 
  };

  const getImageUrl = () => {
    if (!photoPath) return null;
    if (photoPath.startsWith('file:') || photoPath.startsWith('blob:')) {
      return photoPath;
    }
    if (photoPath.startsWith('/')) {
      return `http://${baseUrl}${photoPath}`;
    }
    return photoPath;
  };

  const imageUrl = getImageUrl();
  
  // Format Date for readability
  const displayDate = useMemo(() => {
    if (!date_visited) return '';
    return new Date(date_visited).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [date_visited]);

  // Setup Animation Effect
  useEffect(() => {
    if (itemRef.current) {
      const element = itemRef.current;
      
      // Updated colors to match "Tropical Theme" (Green to Orange pulsing)
      const animation = createAnimation()
        .addElement(element)
        .duration(2000) // Smooth 2s transition
        .iterations(Infinity)
        .direction('alternate') // Flows back and forth for softness
        .keyframes([
          // Offset 0: Aqua / Cyan (Tropical Water)
          { offset: 0, '--background': '#67e8f9' }, 
          // Offset 0.5: Sunny Yellow (Mid-day Sun)
          { offset: 0.5, '--background': '#fde047' }, 
          // Offset 1: Warm Orange (Sunset)
          { offset: 1, '--background': '#fb923c' } 
        ]);

      animationRef.current = animation;

      return () => {
        animation.destroy();
      };
    }
  }, []);

  // Handle "Pending Sync" Animation State
  useEffect(() => {
    const isPending = _pendingSync || _photoPendingSync;

    if (animationRef.current) {
      if (isPending) {
        // If pending, force play the animation to indicate unsaved status
        animationRef.current.play();
      } else {
        // If not pending, stop (unless hovering, which is handled by mouse events)
        animationRef.current.stop();
        if (itemRef.current) {
            itemRef.current.style.setProperty('--background', 'transparent');
        }
      }
    }
  }, [_pendingSync, _photoPendingSync]);

  const handleMouseEnter = () => {
    // Only play hover animation if NOT pending (pending has priority)
    if (!_pendingSync && !_photoPendingSync && animationRef.current) {
      animationRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    // Only stop hover animation if NOT pending
    if (!_pendingSync && !_photoPendingSync && animationRef.current) {
      animationRef.current.stop();
      if (itemRef.current) {
        itemRef.current.style.setProperty('--background', 'transparent');
      }
    }
  };

  return (
    <IonItem 
      ref={itemRef} 
      onClick={handleEdit} 
      button={true}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        '--background': 'transparent', // Important for the scenic background to show through
        '--border-color': 'rgba(0,0,0,0.05)'
      }}
    >
      <IonThumbnail slot="start">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name} 
            style={{ objectFit: 'cover', borderRadius: '8px' }}
            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=No+Image')}
          />
        ) : (
          
          <IonIcon icon={imageOutline} style={{ fontSize: '32px', width: '100%', height: '100%' }} color="medium" />
        )}
      </IonThumbnail>
      
      <IonLabel>
        <h2 style={{ fontWeight: 'bold' }}>{name}</h2>
        <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
             {displayDate && `Visited: ${displayDate}`}
        </p>
      </IonLabel>
    </IonItem>
  );
};

export default Item;