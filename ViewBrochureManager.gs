function apiGetBrochureFiles(token, folderId) {
  try {
    // Validate token if needed (assuming token is handled in main app)
    if (!folderId) return { success: false, message: 'Folder ID tidak valid' };

    const folder = DriveApp.getFolderById(folderId);
    const filesIter = folder.getFiles();
    const files = [];

    while (filesIter.hasNext()) {
      const file = filesIter.next();
      
      // Attempt to get a thumbnail URL, fallback to default drive preview
      let thumbUrl = '';
      const mime = file.getMimeType();
      
      if (mime.includes('image')) {
        thumbUrl = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400-h400`;
      } else if (mime === MimeType.PDF) {
        thumbUrl = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400-h400`; // Drive can generate PDF thumbs
      } else {
        // Generic icon or thumbnail
        thumbUrl = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400-h400`;
      }

      files.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        mimeType: mime,
        dateCreated: file.getDateCreated().getTime(), // use timestamp for sorting
        thumbnail: thumbUrl,
        size: file.getSize()
      });
    }

    // Sort by newest first (descending)
    files.sort((a, b) => b.dateCreated - a.dateCreated);

    return {
      success: true,
      data: files
    };
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}
