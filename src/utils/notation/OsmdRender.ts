/**
 * OSMD rendering utilities for music notation
 */

import { OpenSheetMusicDisplay, type IOSMDOptions } from 'opensheetmusicdisplay';
import { buildNoteElementMap, invalidateNoteCaches } from './NoteInteraction';

export interface OsmdRenderOptions extends Partial<IOSMDOptions> {
  containerId: string;
  width?: number;
  height?: number;
}

// Global OSMD instance
let osmdInstance: OpenSheetMusicDisplay | null = null;

/**
 * Render MusicXML using OSMD
 */
export async function renderOsmd(
  containerId: string,
  musicXml: string,
  options: OsmdRenderOptions = { containerId }
): Promise<OpenSheetMusicDisplay> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element not found: ${containerId}`);
  }

  // Clear previous instance
  if (osmdInstance) {
    osmdInstance.clear();
    invalidateNoteCaches();
  }

  // Extract OSMD-specific options (exclude containerId)
  const { containerId: _, width, height, ...osmdOptions } = options as OsmdRenderOptions;

  osmdInstance = new OpenSheetMusicDisplay(container, {
    autoResize: true,
    backend: 'svg',
    disableCursor: false,
    drawPartNames: true,
    drawComposer: true,
    drawTitle: true,
    drawFingerings: true,
    setWantedStemDirectionByXml: true,
    useXMLMeasureNumbers: true,
    coloringEnabled: true,
    ...osmdOptions,
  });

  await osmdInstance.load(musicXml);
  osmdInstance.render();

  // OSMD's autoResize defers actual SVG population (ResizeObserver fires async).
  // Wait for the SVG to have child elements before building the note map.
  await waitForSvgContent(container);

  // Build DOM element -> note mapping for fast hit-testing
  buildNoteElementMap(container);

  return osmdInstance;
}

/**
 * Wait for the SVG inside the container to have child elements.
 * OSMD's autoResize may defer rendering to a later frame via ResizeObserver,
 * so we poll with requestAnimationFrame until the SVG is populated.
 */
function waitForSvgContent(container: HTMLElement, maxAttempts = 60): Promise<void> {
  return new Promise((resolve) => {
    const svg = container.querySelector('svg');
    if (!svg || svg.children.length > 0) {
      resolve();
      return;
    }
    let attempts = 0;
    const check = () => {
      attempts++;
      if (svg.children.length > 0 || attempts >= maxAttempts) {
        if (attempts >= maxAttempts) {
          console.warn('[OsmdRender] waitForSvgContent: timeout after', maxAttempts, 'frames');
        }
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  });
}

/**
 * Clear the OSMD rendering
 */
export function clearOsmd(): void {
  if (osmdInstance) {
    osmdInstance.clear();
    osmdInstance = null;
    invalidateNoteCaches();
  }
}

/**
 * Get the current OSMD instance
 */
export function getOsmdInstance(): OpenSheetMusicDisplay | null {
  return osmdInstance;
}

/**
 * Move cursor to next note
 */
export function cursorNext(): void {
  osmdInstance?.cursor.next();
}

/**
 * Reset cursor to beginning
 */
export function cursorReset(): void {
  osmdInstance?.cursor.reset();
}

/**
 * Show cursor
 */
export function cursorShow(): void {
  osmdInstance?.cursor.show();
}

/**
 * Hide cursor
 */
export function cursorHide(): void {
  osmdInstance?.cursor.hide();
}

/**
 * Set zoom level
 */
export function setZoom(zoom: number): void {
  if (osmdInstance) {
    osmdInstance.zoom = zoom;
    osmdInstance.render();
  }
}

/**
 * Get current zoom level
 */
export function getZoom(): number {
  return osmdInstance?.zoom ?? 1;
}