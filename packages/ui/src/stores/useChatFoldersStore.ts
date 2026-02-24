import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  isCollapsed: boolean;
}

interface ChatFoldersState {
  folders: ChatFolder[];
  rootFolderName: string;
  // sessionId -> folderId (null = root/no folder)
  sessionFolderMap: Record<string, string | null>;

  createFolder: (name: string, parentId?: string | null) => void;
  renameRootFolder: (name: string) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveFolder: (id: string, newParentId: string | null, newOrder: number) => void;
  assignSession: (sessionId: string, folderId: string | null) => void;
  reorderFolders: (parentId: string | null, orderedIds: string[]) => void;
  toggleFolderCollapse: (id: string) => void;
}

export const useChatFoldersStore = create<ChatFoldersState>()(
  persist(
    (set, get) => ({
      folders: [],
      rootFolderName: 'Unsorted Chats',
      sessionFolderMap: {},

      createFolder: (name, parentId = null) => {
        const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        set((state) => {
          // Find max order in the target parent
          const siblings = state.folders.filter((f) => f.parentId === parentId);
          const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((f) => f.order)) : -1;

          return {
            folders: [
              ...state.folders,
              {
                id,
                name,
                parentId,
                order: maxOrder + 1,
                isCollapsed: false,
              },
            ],
          };
        });
      },

      renameRootFolder: (name) => {
        set({ rootFolderName: name });
      },

      renameFolder: (id, name) => {
        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
        }));
      },

      deleteFolder: (id) => {
        set((state) => {
          // 1. Move children folders to the parent of the deleted folder
          const folderToDelete = state.folders.find((f) => f.id === id);
          const newParentId = folderToDelete?.parentId ?? null;

          const updatedFolders = state.folders
            .filter((f) => f.id !== id)
            .map((f) => (f.parentId === id ? { ...f, parentId: newParentId } : f));

          // 2. Move sessions to the parent (or root)
          const updatedSessionMap = { ...state.sessionFolderMap };
          Object.entries(updatedSessionMap).forEach(([sessionId, folderId]) => {
            if (folderId === id) {
              updatedSessionMap[sessionId] = newParentId;
            }
          });

          return {
            folders: updatedFolders,
            sessionFolderMap: updatedSessionMap,
          };
        });
      },

      moveFolder: (id, newParentId, newOrder) => {
        set((state) => {
          const folder = state.folders.find((f) => f.id === id);
          if (!folder) return state;

          // Prevent circular dependency (moving folder into itself or its children)
          let current = newParentId;
          while (current) {
            if (current === id) return state; // invalid move
            const parent = state.folders.find((f) => f.id === current);
            current = parent?.parentId ?? null;
          }

          const updatedFolders = state.folders.map((f) =>
            f.id === id ? { ...f, parentId: newParentId, order: newOrder } : f
          );

          return { folders: updatedFolders };
        });
      },

      assignSession: (sessionId, folderId) => {
        set((state) => ({
          sessionFolderMap: {
            ...state.sessionFolderMap,
            [sessionId]: folderId,
          },
        }));
      },

      reorderFolders: (parentId, orderedIds) => {
        set((state) => {
          const updatedFolders = [...state.folders];
          orderedIds.forEach((id, index) => {
            const folderIndex = updatedFolders.findIndex((f) => f.id === id);
            if (folderIndex !== -1) {
              updatedFolders[folderIndex] = {
                ...updatedFolders[folderIndex],
                parentId, // Ensure parent matches
                order: index,
              };
            }
          });
          return { folders: updatedFolders };
        });
      },

      toggleFolderCollapse: (id) => {
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, isCollapsed: !f.isCollapsed } : f
          ),
        }));
      },
    }),
    {
      name: 'chat-folders-store',
    }
  )
);
