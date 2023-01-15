/**
 * This file contains the xml templates necessary to create an ePub file.
 * All values that are not explicitly wrapped in NoMap() calls will be html-escaped by the TemplateEngine.
 * All templates expect an EPub instance (or a chapter) as their first argument.
 */


export const containerXml = ({opf}) => `<?xml version="1.0" encoding="UTF-8" ?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="OEBPS/${opf.name}" media-type="${opf.mimeType || 'application/oebps-package+xml'}"/>
	</rootfiles>
</container>`;

export const contentOpf = ({
                               guid,
                               language,
                               title,
                               description,
                               creators,
                               published,
                               chapters,
                               resources,
                               markNav,
                               nav,
                               cover,
                               ncx,
                           }) => `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:opf="http://www.idpf.org/2007/opf"
	xmlns="http://www.idpf.org/2007/opf"
	unique-identifier="Id">
	<metadata>
		<dc:identifier id="Id">${guid}</dc:identifier>
		<meta property="identifier-type" refines="#Id">UUID</meta>
		<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+/, '')}</meta>
		<dc:language>${language}</dc:language>
		<dc:title xml:lang="${language}">${title}</dc:title>

		${description ? `<dc:description xml:lang="${language}">${
    typeof description === 'object' ? description.full || description.short : description
}</dc:description>` : ''}
    ${creators.map((v, i) => `<dc:creator id="author${i}" xml:lang="${language}">${v.name}</dc:creator>
			${v.as ? `<meta refines="#author${i}" property="file-as">${v.as}</meta>` : ''}
			${v.role ? `<meta refines="#author${i}" property="role" scheme="marc:relators">${v.role}</meta>` : ''}
			${v.bio ? `<!-- <meta refines="#author${i}" property="bio" scheme="marc:relators">${v.bio}</meta> -->` : ''}
`).join('')}
    ${published ? `<meta property="dcterms:created">${new Date(+(published || 0)).toISOString().match(/^.*?T/)[0].slice(0, -1)}</meta>` : ''}
	</metadata>

	<manifest>
		<item id="ncx" href="${ncx.name}" media-type="${ncx.mimeType || 'application/x-dtbncx+xml'}"/>
    ${chapters.map((v, i) => `<item id="chapter${i}" href="${v.name}" media-type="${v.mimeType}"${(markNav && v === nav) ? ` properties="nav"` : ''}/>`).join('')}
    ${resources.map((v, i) => `<item id="resource${i}" href="${v.name}" media-type="${v.mimeType}"/>`).join('')}
	</manifest>

	<spine toc="ncx">
    ${chapters.map((_, i) => `<itemref idref="chapter${i}"/>`).join('')}
	</spine>
  ${(cover || nav) ? `<guide>
    ${cover ? `<reference href="${cover.name}" title="${cover.title}" type="cover"/>` : ''}
    ${nav ? `<reference href="${nav.name}" title="${nav.title}" type="toc"/>` : ''}
	</guide>` : ''}
</package>`;

export const contentNcx = ({guid, language, title, creators, chapters}) => `<?xml version="1.0" encoding="UTF-8"?>
<ncx
	xmlns="http://www.daisy.org/z3986/2005/ncx/"
	version="2005-1"
	xml:lang="${language}">
	<head>
		<meta name="dtb:uid" content="${guid}"/>
	</head>
	<docTitle>
		<text>${title}</text>
	</docTitle>
	<docAuthor>
		<text>${creators.find(it => it.role === 'author').name}</text>
	</docAuthor>
	<navMap>
    ${chapters.map((v, i) => `
    <navPoint playOrder="${i + 1}" id="chapter${i + 1}">
			<navLabel>
				<text>${v.title}</text>
			</navLabel>
			<content src="${v.name}"/>
		</navPoint>
    `).join('')}
	</navMap>
</ncx>`;

export const xhtmlFrame = ({content, title}) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
 "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
	<head>
		<title>${title}</title>
	</head>
	<body>${content}</body>
</html>`;
