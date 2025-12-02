import React, { useRef, useEffect } from 'react';
import { 
  IonItem, 
  IonLabel, 
  IonThumbnail, 
  IonIcon, 
  createAnimation 
} from '@ionic/react';
import type { Animation } from '@ionic/core';
import { flowerOutline, imagesOutline } from 'ionicons/icons';
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
  no_petals,
  scientific_name,
  class: flowerClass,
  has_photo,
  photoPath,
  date_added,
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
  log('render', name, 'photoPath:', photoPath, 'imageUrl:', imageUrl);

  useEffect(() => {
    if (itemRef.current) {
      const element = itemRef.current;
      
      const animation = createAnimation()
        .addElement(element)
        .duration(800)
        .iterations(Infinity)
        .direction('alternate')
        .keyframes([
          { offset: 0, backgroundColor: '#ffffff' },
          { offset: 0.5, backgroundColor: '#dd5ab0' },
          { offset: 1, backgroundColor: '#42d9c6' }
        ]);

      animationRef.current = animation;

      const onMouseEnter = () => {
        if (!_pendingSync && !_photoPendingSync) {
          log('Playing animation on hover');
          element.classList.add('animating');
          animation.play();
        }
      };

      const onMouseLeave = () => {
        if (!_pendingSync && !_photoPendingSync) {
          log('Stopping animation on leave');
          animation.stop();
          element.classList.remove('animating');
          element.style.backgroundColor = '';
        }
      };

      element.addEventListener('mouseenter', onMouseEnter);
      element.addEventListener('mouseleave', onMouseLeave);

      return () => {
        element.removeEventListener('mouseenter', onMouseEnter);
        element.removeEventListener('mouseleave', onMouseLeave);
        animation.destroy();
      };
    }
  }, [_pendingSync, _photoPendingSync]);

  useEffect(() => {
    const isPending = _pendingSync === true || _photoPendingSync === true;

    if (animationRef.current && isPending) {
      animationRef.current.play();
    } else if (animationRef.current && !isPending) {
      animationRef.current.stop();
    }
  }, [_pendingSync, _photoPendingSync]);

  const handleMouseEnter = () => {
    if (!_pendingSync && !_photoPendingSync && animationRef.current) {
      log('Playing animation on hover');
      animationRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    if (!_pendingSync && !_photoPendingSync && animationRef.current) {
      log('Stopping animation on leave');
      animationRef.current.stop();
      if (itemRef.current) {
        itemRef.current.style.background = '';
      }
    }
  };

  return (
    <IonItem 
      ref={itemRef} 
      onClick={handleEdit} 
      button={true}
      style={{
        background: 'transparent'
      }}
    >
      <IonThumbnail slot="start">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name} 
            style={{ objectFit: 'cover' }}
            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=No+Image')}
          />
        ) : has_photo ? (
          <IonIcon icon={imagesOutline} style={{ fontSize: '40px' }} color="medium" />
        ) : (
          <IonIcon icon={flowerOutline} style={{ fontSize: '40px' }} color="medium" />
        )}
      </IonThumbnail>
      <IonLabel>
        <h2>{name}</h2>
        <p>Scientific Name: {scientific_name}</p>
        <p>Class: {flowerClass} | Petals: {no_petals}</p>
      </IonLabel>
    </IonItem>
  );
};

export default Item;