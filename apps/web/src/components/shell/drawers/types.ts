/** What every URL drawer takes (`DrawerHost` mounts the one `?d=` names). */
export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
