export interface ItemProps {
  _id?: string;
  name: string;
  rating : number;
  visit_again: boolean;
  date_visited: string;
  
  tempId?: string;
  _pendingSync?: boolean; 
  
  photoPath?: string; 
  latitude?: number;
  longitude?: number;
  

  _photoPendingSync?: boolean; 
}