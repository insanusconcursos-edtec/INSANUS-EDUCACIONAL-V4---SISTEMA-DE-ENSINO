/**
 * Panda Video Frontend Service
 * Handles API calls to Panda Video via the relative path (/api/panda)
 * This path is intercepted by Vercel rewrites in production and Vite proxy in development.
 */

const PANDA_BASE_URL = '/api/panda';
const PANDA_API_KEY = import.meta.env.VITE_PANDA_API_KEY;

interface PandaFolder {
  id: string;
  name?: string;
  title?: string;
  parent_folder_id?: string | null;
  parent_id?: string | null;
  parentId?: string | null;
}

interface PandaVideo {
  id?: string;
  video_id?: string;
  title?: string;
  name?: string;
  video_player_url?: string;
  embed_url?: string;
  folder_id?: string | null;
  folderId?: string | null;
}

export const pandaService = {
  /**
   * List videos from Panda Video
   * @param search Optional search term
   * @returns List of videos
   */
  async listVideos(search: string = '') {
    try {
      let url = `${PANDA_BASE_URL}/videos?limit=1000`;
      if (search) {
        url += `&title=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': PANDA_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Panda: ${response.status}`);
      }

      const data = await response.json();
      const videos = data.videos || data || [];
      
      // Retorna ID, Título e URL de Embed se disponível (Limpeza de dados no frontend)
      return Array.isArray(videos) ? videos.map((v: PandaVideo) => ({
        id: v.id || v.video_id,
        title: v.title || v.name || 'Sem título',
        video_player_url: v.video_player_url || v.embed_url || null
      })) : [];
    } catch (error) {
      console.error("Erro ao listar vídeos do Panda:", error);
      throw error;
    }
  },

  /**
   * List folders and videos from Panda Video (Explorer with hierarchy logic)
   * @param folderId Optional folder ID
   * @returns Folders and videos
   */
  async explorer(folderId: string | null = null) {
    try {
      const headers = {
        'Authorization': PANDA_API_KEY,
        'Accept': 'application/json'
      };

      // URLs para pastas e vídeos
      const foldersUrl = `${PANDA_BASE_URL}/folders`;
      let videosUrl = `${PANDA_BASE_URL}/videos?limit=1000`;

      // Se tivermos um folderId, podemos tentar otimizar a busca de vídeos na API
      if (folderId && folderId !== 'root' && folderId !== 'null') {
        videosUrl += `&folder_id=${folderId}`;
      }

      // Requisições paralelas
      const [foldersRes, videosRes] = await Promise.all([
        fetch(foldersUrl, { method: 'GET', headers }),
        fetch(videosUrl, { method: 'GET', headers })
      ]);

      if (!foldersRes.ok || !videosRes.ok) {
        throw new Error(`Erro na API do Panda: F:${foldersRes.status} V:${videosRes.status}`);
      }

      const foldersData = await foldersRes.json();
      const videosData = await videosRes.json();

      const foldersArray = foldersData.folders || (Array.isArray(foldersData) ? foldersData : []);
      const videosArray = videosData.videos || (Array.isArray(videosData) ? videosData : []);

      const isRoot = !folderId || folderId === 'root' || folderId === 'null' || folderId === '';

      // Filtro de Hierarquia para Pastas
      const strictFolders = foldersArray.filter((folder: PandaFolder) => {
        const parentId = folder.parent_folder_id || folder.parent_id || folder.parentId || null;
        if (isRoot) {
          return !parentId || parentId === 'null' || parentId === '';
        } else {
          return String(parentId) === String(folderId);
        }
      });

      // Ordenação alfabética das pastas
      strictFolders.sort((a: PandaFolder, b: PandaFolder) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));

      const folders = strictFolders.map((f: PandaFolder) => ({
        id: f.id,
        name: f.name || f.title || 'Pasta sem nome'
      }));

      // Filtro de Hierarquia para Vídeos
      const strictVideos = videosArray.filter((video: PandaVideo) => {
        const videoFolderId = video.folder_id || video.folderId || null;
        if (isRoot) {
          return !videoFolderId || videoFolderId === 'null' || videoFolderId === '';
        } else {
          return String(videoFolderId) === String(folderId);
        }
      });

      // Ordenação alfabética dos vídeos
      strictVideos.sort((a: PandaVideo, b: PandaVideo) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));

      const videos = strictVideos.map((v: PandaVideo) => ({
        id: v.id || v.video_id,
        title: v.title || v.name || 'Sem título',
        video_player_url: v.video_player_url || v.embed_url || null
      }));

      return { folders, videos };
    } catch (error) {
      console.error("Erro no Explorer do Panda:", error);
      throw error;
    }
  }
};
