export interface ItemProps {
  _id?: string;
  name: string;
  no_petals: number;
  scientific_name: string;
  class: string;
  has_photo: boolean;
  date_added: string;
  
  tempId?: string;
  _pendingSync?: boolean; // For items that failed to save text
  
  photoPath?: string; 
  latitude?: number;
  longitude?: number;
  

  _photoPendingSync?: boolean; 
}