/**
 * RENDERIZADOR DE TEMPLATES HTML
 * ===============================
 * Combina layout + contenido + datos
 */

import fs from 'fs';
import path from 'path';
import type { TemplateData } from './types';

/**
 * Renderizar template simple (reemplazo de variables)
 */
export function renderTemplate(html: string, data: TemplateData): string {
  let rendered = html;

  // Reemplazar variables {{variable}}
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, String(data[key] || ''));
  });

  // Reemplazar condicionales {{#if variable}}...{{/if}}
  rendered = rendered.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, key, content) => {
    return data[key] ? content : '';
  });

  // Reemplazar loops {{#each items}}...{{/each}}
  rendered = rendered.replace(/{{#each\s+(\w+)}}(.*?){{\/each}}/gs, (match, key, template) => {
    const items = data[key];
    if (!Array.isArray(items)) return '';
    
    return items.map(item => {
      let itemHtml = template;
      Object.keys(item).forEach(prop => {
        const regex = new RegExp(`{{\\s*${prop}\\s*}}`, 'g');
        itemHtml = itemHtml.replace(regex, String(item[prop] || ''));
      });
      return itemHtml;
    }).join('');
  });

  return rendered;
}

/**
 * Cargar template desde archivo
 */
export function loadTemplate(templateName: string): string {
  // Primero intentar en el subdirectorio actions/
  let templatePath = path.join(process.cwd(), 'src/server/email/templates/actions', `${templateName}.html`);
  
  // Si no existe, intentar en la raíz de templates/
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(process.cwd(), 'src/server/email/templates', `${templateName}.html`);
  }
  
  if (!fs.existsSync(templatePath)) {
    console.error(`[RENDERER] Template no encontrado: ${templateName}`);
    return '';
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Aplicar layout base
 */
export function applyLayout(content: string, data: TemplateData = {}): string {
  const layoutPath = path.join(process.cwd(), 'src/server/email/templates/layout.html');
  
  if (!fs.existsSync(layoutPath)) {
    // Si no hay layout, devolver contenido directo
    return content;
  }

  const layout = fs.readFileSync(layoutPath, 'utf-8');
  
  // Reemplazar {{content}} con el contenido real
  let rendered = layout.replace('{{content}}', content);
  
  // Aplicar datos globales al layout
  rendered = renderTemplate(rendered, {
    year: new Date().getFullYear(),
    appUrl: process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com',
    ...data,
  });

  return rendered;
}

/**
 * Renderizar template completo (template + layout + datos)
 */
export function renderEmailTemplate(
  templateName: string,
  data: TemplateData,
  useLayout: boolean = true
): string {
  const template = loadTemplate(templateName);
  if (!template) return '';

  const content = renderTemplate(template, data);

  if (useLayout) {
    return applyLayout(content, data);
  }

  return content;
}

/**
 * Generar texto plano desde HTML (básico)
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*<\/style>/gm, '')
    .replace(/<script[^>]*>.*<\/script>/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s\s+/g, ' ')
    .trim();
}
