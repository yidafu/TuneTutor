/**
 * OSMD rendering utilities for music notation
 */

import { OpenSheetMusicDisplay, type IOSMDOptions } from 'opensheetmusicdisplay';

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

  return osmdInstance;
}

/**
 * Clear the OSMD rendering
 */
export function clearOsmd(): void {
  if (osmdInstance) {
    osmdInstance.clear();
    osmdInstance = null;
  }
}

/**
 * Get the current OSMD instance
 */
export function getOsmdInstance(): OpenSheetMusicDisplay | null {
  return osmdInstance;
}

/**
 * Get cursor for playback control
 */
export function getOsmdCursor() {
  if (!osmdInstance) return null;
  // cursor is a public property
  return (osmdInstance as unknown as { cursor: unknown }).cursor;
}

/**
 * Move cursor to next note
 */
export function cursorNext(): void {
  osmdInstance?.cursor.next();
}

/**
 * Move cursor to previous note
 */
export function cursorPrevious(): void {
  osmdInstance?.cursor.previous();
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