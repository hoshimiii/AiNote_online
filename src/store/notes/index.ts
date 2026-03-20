// import { create } from "zustand";
// import { persist } from "zustand/middleware";


// export type Note = {
//     noteId: string;
//     noteTitle: string;
//     noteContent: string;
//     noteCreatedAt: string;
//     noteUpdatedAt: string;
//     relatedTaskId: string;
// }

// interface NotesProps {
//     missionId: string;
//     setMissionId: (missionId: string) => void;
//     notes: Record<string, Note>;
//     createNote: (note: Note) => Note;
//     updateNote: (noteId: string, note: Note) => void;
//     deleteNote: (noteId: string) => void;
//     setRelatedTaskId: (noteId: string, relatedTaskId: string) => void;
// }


// export const useNotes = create<NotesProps>()(
//     persist(
//         (set, get) => ({
//             missionId: '',
//             notes: {},
//             setMissionId: (missionId) => {
//                 set({ missionId });
//             },
//             createNote: (note) => {
//                 set((state) => ({ notes: { ...state.notes, [note.noteId]: note } }));
//                 return note;
//             },
//             updateNote: (noteId, note) => {
//                 set((state) => ({ notes: { ...state.notes, [noteId]: { ...state.notes[noteId], ...note } } }));
//             },
//             deleteNote: (noteId) => {
//                 set((state) => ({ notes: Object.fromEntries(Object.entries(state.notes).filter(([id]) => id !== noteId)) }));
//             },
//             setRelatedTaskId: (noteId, relatedTaskId) => {
//                 set((state) => ({ notes: { ...state.notes, [noteId]: { ...state.notes[noteId], relatedTaskId } } }));
//             },

//         }),
//         { name: 'notes-storage' }
//     )
// )