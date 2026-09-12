/** Rasterize the actual SVG preview at print resolution, including dynamic
 * Bengali text, so PDFs do not depend on fonts installed on the print machine. */
export async function createPropertyQrPdf(
  poster: SVGSVGElement,
  propertyCode: string,
): Promise<Blob> {
  await document.fonts.ready;
  const svg = poster.cloneNode(true) as SVGSVGElement;
  const artwork = svg.querySelector("image");
  const artworkHref = artwork?.getAttribute("href");
  if (!artwork || !artworkHref) throw new Error("Poster artwork is missing");
  const response = await fetch(artworkHref);
  if (!response.ok) throw new Error("Poster artwork could not be loaded");
  const imageBlob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Poster artwork could not be read"));
    reader.readAsDataURL(imageBlob);
  });
  artwork.setAttribute("href", dataUrl);
  svg.setAttribute("width", "1024");
  svg.setAttribute("height", "1536");
  svg.removeAttribute("class");
  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 3072;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Poster could not be rendered");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Load the PDF library only when the user requests a download.
    const { PDFDocument, PageSizes } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${propertyCode} - Bikalpo To-Let poster`);
    pdf.setCreator("Bikalpo");
    const page = pdf.addPage(PageSizes.A4);
    const png = await pdf.embedPng(canvas.toDataURL("image/png"));
    const margin = 18;
    const scale = Math.min(
      (page.getWidth() - margin * 2) / 1024,
      (page.getHeight() - margin * 2) / 1536,
    );
    const width = 1024 * scale;
    const height = 1536 * scale;
    page.drawImage(png, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
    });
    const bytes = await pdf.save();
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
