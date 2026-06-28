import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://assetflow.africa";
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/landing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  ];
}
