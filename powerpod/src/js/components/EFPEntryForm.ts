import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import '@shoelace-style/shoelace/dist/components/details/details.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';

import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import './NavigationButtons';
import './RatingQuestion';
import './EFPBreadcrumbs';

// Type definitions for better type safety
interface EFPStep {
  label: string;
  content: string;
  complete?: boolean;
  sectionIndex: number;
  chapterData?: any;
  subchapterData?: any;
  isContainer?: boolean;
}

interface EFPSection {
  tab: string;
  title: string;
  items: EFPSectionItem[];
}

interface EFPSectionItem {
  label: string;
  content?: string;
  complete?: boolean;
  items?: EFPSectionItem[];
  title?: string;
  isContainer?: boolean;
  chapterData?: any;
  subchapterData?: any;
}

interface EFPActiveContent {
  title: string;
  content: string;
}

// Utility class for logging (can be disabled in production)
class EFPLogger {
  private static DEBUG = true; // Set to false in production

  static log(...args: any[]): void {
    if (EFPLogger.DEBUG) {
      console.log('[EFP]', ...args);
    }
  }

  static warn(...args: any[]): void {
    if (EFPLogger.DEBUG) {
      console.warn('[EFP]', ...args);
    }
  }

  static error(...args: any[]): void {
    if (EFPLogger.DEBUG) {
      console.error('[EFP]', ...args);
    }
  }
}

// Utility class for text formatting
class EFPTextUtils {
  static formatChapterTitle(chapterName: string): string {
    // Transform "CHAPTER 2 BUILDINGS AND ROADS" to "Chapter 2: Buildings and Roads"
    // Transform "PLANT BIODIVERSITY" to "Plant Biodiversity"
    if (!chapterName) return '';

    // Convert to title case and handle the chapter format
    const titleCase = chapterName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    // If it starts with "Chapter" and has a number, add a colon after the number
    const chapterMatch = titleCase.match(/^Chapter (\d+(?:\.\d+)?) (.+)$/);
    if (chapterMatch) {
      const [, chapterNum, chapterTitle] = chapterMatch;
      return `Chapter ${chapterNum}: ${chapterTitle}`;
    }

    return titleCase;
  }

  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

// Utility class for completion calculations
class EFPCompletionUtils {
  static calculateOverallCompletion(sections: EFPSection[]): number {
    const allItems: EFPSectionItem[] = [];

    const collect = (items: EFPSectionItem[]) => {
      for (const item of items) {
        if ('items' in item && Array.isArray(item.items)) {
          collect(item.items);
        } else {
          allItems.push(item);
        }
      }
    };

    for (const section of sections) {
      collect(section.items);
    }

    const completed = allItems.filter((item) => item.complete).length;
    return allItems.length === 0
      ? 0
      : Math.round((completed / allItems.length) * 100);
  }

  static isSectionComplete(section: EFPSection): boolean {
    const leafItems: EFPSectionItem[] = [];

    const collect = (items: EFPSectionItem[]) => {
      for (const item of items) {
        if ('items' in item && Array.isArray(item.items)) {
          collect(item.items);
        } else {
          leafItems.push(item);
        }
      }
    };

    collect(section.items);
    return leafItems.every((item) => item.complete);
  }
}

// Utility class for section generation
class EFPSectionGenerator {
  static generateSectionBItems(nestedChapterStructure: any[]): EFPSectionItem[] {
    if (!nestedChapterStructure || nestedChapterStructure.length === 0) {
      EFPLogger.log('SectionGenerator: No nested chapter structure available, showing loading message');
      return [
        {
          label: 'Loading Chapters...',
          content: `
            <h3>Loading Environmental Farm Plan Chapters</h3>
            <p>Please wait while we load the questionnaire chapters and questions...</p>
          `,
          complete: false,
        }
      ];
    }

    const items: EFPSectionItem[] = [];

    nestedChapterStructure.forEach((chapter: any) => {
      // Extract chapter number from the main chapter
      const chapterNumber = Math.floor(chapter.order || 0);

      // Create the main chapter container (collapsible parent)
      const chapterItem: EFPSectionItem = {
        label: `Chapter ${chapterNumber}`,
        title: `Chapter ${chapterNumber}`,
        content: '', // No content for the parent container
        complete: false,
        isContainer: true, // Mark as container only
        items: []
      };

      // Add all subchapters as direct clickable items under the main chapter
      if (chapter.subchapters && chapter.subchapters.length > 0) {
        chapter.subchapters.forEach((subchapter: any) => {
          // Add the subchapter as a clickable item with order number
          const subchapterOrder = subchapter.order || 0;
          const subchapterTitle = subchapter.name || subchapter.label;

          // Format subchapter title to include order number (e.g., "7.1 Biodiversity")
          let formattedSubchapterTitle;
          if (subchapterOrder && subchapterOrder !== Math.floor(subchapterOrder)) {
            // This is a decimal order (e.g., 7.1), show as "7.1 Title"
            const cleanTitle = subchapterTitle.replace(/^CHAPTER\s+\d+(\.\d+)?\s+/i, '');
            formattedSubchapterTitle = `${subchapterOrder} ${EFPTextUtils.formatChapterTitle(cleanTitle)}`;
            console.log(`Subchapter: ${subchapterOrder} -> "${formattedSubchapterTitle}"`);
          } else {
            // Fallback to original formatting
            formattedSubchapterTitle = EFPTextUtils.formatChapterTitle(subchapterTitle);
            console.log(`Subchapter (no order): "${formattedSubchapterTitle}"`);
          }

          const subchapterItem: EFPSectionItem = {
            label: formattedSubchapterTitle,
            content: EFPSectionGenerator.renderSubchapterContent(subchapter),
            complete: false,
            subchapterData: subchapter,
          };

          // If subchapter has sub-subchapters, add them as nested items
          if (subchapter.subchapters && subchapter.subchapters.length > 0) {
            subchapterItem.items = subchapter.subchapters.map((subSubchapter: any) => {
              // Format sub-subchapter title with order number (e.g., "7.11 Plant Biodiversity")
              const subSubOrder = subSubchapter.order || 0;
              const subSubTitle = subSubchapter.name || subSubchapter.label;

              let formattedSubSubTitle;
              if (subSubOrder) {
                // Show order number with title (e.g., "7.11 Plant Biodiversity")
                const cleanTitle = subSubTitle.replace(/^CHAPTER\s+\d+(\.\d+)?\s+/i, '');
                formattedSubSubTitle = `${subSubOrder} ${EFPTextUtils.formatChapterTitle(cleanTitle)}`;
                console.log(`Sub-subchapter: ${subSubOrder} -> "${formattedSubSubTitle}"`);
              } else {
                // Fallback: remove chapter prefix and format
                const subSubLabel = subSubTitle.replace(/^CHAPTER\s+\d+\.\d+\s+/i, '');
                formattedSubSubTitle = EFPTextUtils.formatChapterTitle(subSubLabel);
                console.log(`Sub-subchapter (no order): "${formattedSubSubTitle}"`);
              }

              return {
                label: formattedSubSubTitle,
                content: EFPSectionGenerator.renderSubchapterContent(subSubchapter),
                complete: false,
                subchapterData: subSubchapter,
              };
            });

            // Add title property for sl-details rendering
            subchapterItem.title = subchapterItem.label;
          }

          // Always add the subchapter to the main chapter items
          chapterItem.items!.push(subchapterItem);
        });
      } else {
        // If no subchapters, add the main chapter itself as a clickable item
        const formattedTitle = EFPTextUtils.formatChapterTitle(chapter.name || chapter.label);
        chapterItem.items!.push({
          label: formattedTitle,
          content: EFPSectionGenerator.renderChapterContent(chapter),
          complete: false,
          chapterData: chapter
        });
      }

      items.push(chapterItem);
    });

    return items;
  }

  static renderSubchapterContent(subchapter: any): string {
    const subSubchaptersCount = subchapter.subchapters?.length || 0;
    const subSubchaptersInfo = subSubchaptersCount > 0
      ? `<p style="font-family: var(--body-font); font-weight: 500; color: var(--sl-color-neutral-600); margin: 0;"><strong>Sub-sections:</strong> ${subSubchaptersCount}</p>`
      : '';

    return `
      <div class="subchapter-content">
        <h3 style="font-family: var(--chapter-font); font-weight: 600; font-size: 1.5rem; color: var(--sl-color-neutral-800); margin-bottom: 1rem;">${subchapter.name || subchapter.label}</h3>
        <div style="font-family: var(--body-font); line-height: 1.6; color: var(--sl-color-neutral-700); margin-bottom: 1rem;">${subchapter.description || ''}</div>
        <div style="display: flex; gap: 2rem; margin-bottom: 1rem;">
          <p style="font-family: var(--body-font); font-weight: 500; color: var(--sl-color-neutral-600); margin: 0;"><strong>Questions:</strong> ${subchapter.questions?.length || 0}</p>
          ${subSubchaptersInfo}
        </div>
      </div>
    `;
  }

  static renderChapterContent(chapter: any): string {
    const formattedTitle = EFPTextUtils.formatChapterTitle(chapter.name);
    return `
      <div class="chapter-content">
        <h3 style="font-family: var(--chapter-font); font-weight: 700; font-size: 1.75rem; color: var(--sl-color-primary-900); margin-bottom: 1rem; letter-spacing: -0.025em;">${formattedTitle}</h3>
        <div style="font-family: var(--body-font); line-height: 1.6; color: var(--sl-color-neutral-700); margin-bottom: 1.5rem; font-size: 1.05rem;">${chapter.description || ''}</div>
        <div style="display: flex; gap: 2rem; margin-bottom: 1rem;">
          <p style="font-family: var(--body-font); font-weight: 500; color: var(--sl-color-neutral-600); margin: 0;"><strong>Questions:</strong> ${chapter.questions?.length || 0}</p>
          <p style="font-family: var(--body-font); font-weight: 500; color: var(--sl-color-neutral-600); margin: 0;"><strong>Subchapters:</strong> ${chapter.subchapters?.length || 0}</p>
        </div>
      </div>
    `;
  }
}

// Utility class for navigation helpers
class EFPNavigationUtils {
  static isStepContainer(step: EFPStep, sections: EFPSection[]): boolean {
    // Check if this step corresponds to a container item
    // Container items are those that have 'items' property in the original structure
    // and are marked as containers, or have empty/placeholder content

    // If the step has no actual content or is marked as container
    if (!step.content || step.content === '') {
      return true;
    }

    // Check if this step corresponds to a main chapter container
    for (const section of sections) {
      for (const item of section.items) {
        if ('items' in item && Array.isArray(item.items)) {
          for (const subItem of item.items) {
            if (subItem.label === step.label && subItem.isContainer) {
              return true;
            }
          }
        }
      }
    }

    // Check if the step label matches a chapter container pattern (e.g., "Chapter 6", "Chapter 7")
    if (/^Chapter \d+$/.test(step.label)) {
      return true;
    }

    // Check if the step label matches a subchapter container pattern (e.g., "Chapter 6: Nutrient Application")
    if (/^Chapter \d+: /.test(step.label)) {
      // Check if there's a next step that would be a child of this container
      // This is a heuristic to determine if this is a container
      const flatSteps = EFPNavigationUtils.getFlatStepsFromSections(sections);
      const currentIndex = flatSteps.findIndex(s => s.label === step.label);
      if (currentIndex >= 0 && currentIndex < flatSteps.length - 1) {
        const nextStep = flatSteps[currentIndex + 1];
        if (nextStep && nextStep.label.length > step.label.length &&
            !nextStep.label.startsWith('Chapter ') &&
            nextStep.content && nextStep.content.trim() !== '') {
          return true;
        }
      }
    }

    // Check if the content contains the container message
    if (step.content && step.content.includes('Please select a specific chapter section')) {
      return true;
    }

    return false;
  }

  static findLastSelectableStepInSection(sectionIndex: number, flatSteps: EFPStep[], sections: EFPSection[]): { step: EFPStep, index: number } | null {
    // Find all steps in the given section
    const stepsInSection: { step: EFPStep, index: number }[] = [];

    flatSteps.forEach((step, index) => {
      if (step.sectionIndex === sectionIndex) {
        stepsInSection.push({ step, index });
      }
    });

    // Go through the steps in reverse order to find the last selectable one
    for (let i = stepsInSection.length - 1; i >= 0; i--) {
      const { step, index } = stepsInSection[i];
      const isContainer = EFPNavigationUtils.isStepContainer(step, sections);

      if (!isContainer) {
        EFPLogger.log(`Found last selectable step in section ${sectionIndex}: "${step.label}" at index ${index}`);
        return { step, index };
      }
    }

    EFPLogger.warn(`No selectable steps found in section ${sectionIndex}`);
    return null;
  }

  static findFirstSelectableStepInSection(sectionIndex: number, flatSteps: EFPStep[], sections: EFPSection[]): { step: EFPStep, index: number } | null {
    // Find all steps in the given section
    const stepsInSection: { step: EFPStep, index: number }[] = [];

    flatSteps.forEach((step, index) => {
      if (step.sectionIndex === sectionIndex) {
        stepsInSection.push({ step, index });
      }
    });

    // Go through the steps in order to find the first selectable one (skip section headers)
    for (let i = 0; i < stepsInSection.length; i++) {
      const { step, index } = stepsInSection[i];
      const isContainer = EFPNavigationUtils.isStepContainer(step, sections);

      // Skip section headers like "Section A", "Section B", etc.
      if (!isContainer && !step.label.startsWith('Section ')) {
        EFPLogger.log(`Found first selectable step in section ${sectionIndex}: "${step.label}" at index ${index}`);
        return { step, index };
      }
    }

    EFPLogger.warn(`No selectable steps found in section ${sectionIndex}`);
    return null;
  }

  static findContainersForItem(itemLabel: string, sections: EFPSection[]): string[] {
    const containers: string[] = [];

    // Recursive function to search through the navigation structure
    const searchItems = (items: EFPSectionItem[], parentContainers: string[] = []) => {
      for (const item of items) {
        const currentPath = [...parentContainers];

        if ('items' in item && Array.isArray(item.items)) {
          // This is a container, add it to the current path
          if (item.title) {
            currentPath.push(item.title);
          }

          // Check if the target item exists in this container's children
          const foundInChildren = EFPNavigationUtils.itemExistsInChildren(item.items, itemLabel);
          if (foundInChildren) {
            containers.push(...currentPath);
          }

          // Recursively search children
          searchItems(item.items, currentPath);
        }
      }
    };

    // Search through all sections
    sections.forEach(section => {
      if (section.items) {
        searchItems(section.items);
      }
    });

    return containers;
  }

  static itemExistsInChildren(items: EFPSectionItem[], targetLabel: string): boolean {
    for (const item of items) {
      if (item.label === targetLabel) {
        return true;
      }
      if ('items' in item && Array.isArray(item.items)) {
        if (EFPNavigationUtils.itemExistsInChildren(item.items, targetLabel)) {
          return true;
        }
      }
    }
    return false;
  }

  // Helper method to get flat steps from sections (used internally)
  private static getFlatStepsFromSections(sections: EFPSection[]): EFPStep[] {
    const result: EFPStep[] = [];

    const collect = (items: EFPSectionItem[], sectionIndex: number) => {
      for (const item of items) {
        if ('items' in item && Array.isArray(item.items)) {
          result.push({
            label: item.title || item.label,
            content: '', // Container items have no content
            sectionIndex,
            isContainer: true,
          });
          collect(item.items, sectionIndex);
        } else {
          const stepItem: EFPStep = {
            label: item.label,
            content: item.content ?? '',
            complete: item.complete ?? false,
            sectionIndex,
          };

          // Add chapter data if it exists (for chapters)
          if (item.chapterData) {
            stepItem.chapterData = item.chapterData;
          }

          // Add subchapter data if it exists (for subchapters)
          if (item.subchapterData) {
            stepItem.subchapterData = item.subchapterData;
          }

          // Mark as container if specified
          if (item.isContainer) {
            stepItem.isContainer = item.isContainer;
          }

          result.push(stepItem);
        }
      }
    };

    sections.forEach((section, index) => {
      result.push({
        label: section.tab,
        content: section.title,
        sectionIndex: index,
      });
      collect(section.items, index);
    });

    return result;
  }
}

// Utility class for rendering helpers
class EFPRenderUtils {
  static renderMainContent(
    currentSectionIndex: number,
    flatSteps: EFPStep[],
    currentStepIndex: number,
    activeContent: EFPActiveContent,
    html: any,
    unsafeHTML: any,
    renderSubchapter: (subchapterData: any) => any,
    renderChapter: (chapterData: any) => any
  ): any {
    // Check if we're in Section B and have a chapter to render
    if (currentSectionIndex === 1) { // Section B is index 1
      const currentStep = flatSteps[currentStepIndex];

      // Check if it's a container item (should not be selectable)
      if (currentStep && 'isContainer' in currentStep && currentStep.isContainer) {
        return html`
          <div class="container-message">
            <h3>Please select a specific chapter section from the navigation</h3>
            <p>This is a chapter container. Click on one of the specific sections in the navigation to view its content.</p>
          </div>
        `;
      }
      // Check if it's a subchapter
      else if (currentStep && 'subchapterData' in currentStep) {
        return renderSubchapter(currentStep.subchapterData);
      }
      // Check if it's a main chapter
      else if (currentStep && 'chapterData' in currentStep) {
        return renderChapter(currentStep.chapterData);
      }
    }

    // Default content rendering
    return html`<div>${unsafeHTML(activeContent.content)}</div>`;
  }

  static renderItems(
    items: EFPSectionItem[],
    html: any,
    activeContentTitle: string,
    onItemClick: (item: EFPSectionItem) => void,
    renderItems: (items: EFPSectionItem[]) => any
  ): any {
    return items.map((item) => {
      if ('items' in item && Array.isArray(item.items)) {
        // For container items, render as a clickable header with nested items always visible
        return html`
          <div class="nav-container">
            <div
              class="nav-container-header"
              style=${activeContentTitle === item.label
                ? 'font-weight: 600; background-color: var(--sl-color-primary-50); color: var(--sl-color-primary-800); padding: 0.5rem; border-radius: var(--sl-border-radius-small); cursor: pointer; margin-bottom: 0.5rem;'
                : 'font-weight: 500; padding: 0.5rem; border-radius: var(--sl-border-radius-small); cursor: pointer; transition: background-color 0.2s ease; margin-bottom: 0.5rem;'}
              @click=${() => onItemClick(item)}
              @mouseover=${(e: Event) => {
                if (activeContentTitle !== item.label) {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--sl-color-neutral-50)';
                }
              }}
              @mouseout=${(e: Event) => {
                if (activeContentTitle !== item.label) {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <sl-icon
                name=${item.complete ? 'check-circle' : 'folder'}
                style="color: ${item.complete ? 'var(--sl-color-success-600)' : 'var(--sl-color-primary-600)'}"
              ></sl-icon>
              ${item.title || item.label}
            </div>
            <div class="nav-container-children" style="margin-left: 1rem;">
              ${renderItems(item.items)}
            </div>
          </div>
        `;
      } else {
        return html`
          <div
            class="nav-subchapter-title"
            style=${activeContentTitle === item.label
              ? 'font-weight: 600; background-color: var(--sl-color-primary-50); color: var(--sl-color-primary-800);'
              : 'font-weight: 500;'}
            @click=${() => onItemClick(item)}
          >
            <sl-icon
              name=${item.complete ? 'check-circle' : 'pencil'}
              style="color: ${item.complete ? 'var(--sl-color-success-600)' : 'var(--sl-color-warning-600)'}"
            ></sl-icon>
            ${item.label}
          </div>
        `;
      }
    });
  }
}

// Utility class for event handling helpers
class EFPEventUtils {
  static handleItemClick(
    item: EFPSectionItem,
    flatSteps: EFPStep[],
    onStepChange: (stepIndex: number, sectionIndex: number) => void,
    onNavigationUpdate: (label: string) => void
  ): void {
    const index = flatSteps.findIndex((i) => i.label === item.label);
    console.log(`Navigation click: Looking for "${item.label}", found at index: ${index}`);

    if (index !== -1) {
      const sectionIndex = flatSteps[index].sectionIndex;
      console.log(`Set currentStepIndex to ${index}, currentSectionIndex to ${sectionIndex}`);

      onStepChange(index, sectionIndex);
      onNavigationUpdate(item.label);
    } else {
      console.warn(`Step "${item.label}" not found in flatSteps. Available steps:`, flatSteps.map(s => s.label));
    }
  }

  static handleSectionChange(
    newSectionIndex: number,
    isNavigating: boolean,
    flatSteps: EFPStep[],
    onStepChange: (stepIndex: number, sectionIndex: number) => void,
    onNavigationUpdate: (label: string) => void
  ): void {
    console.log('Section changed to:', newSectionIndex, 'isNavigating:', isNavigating);

    // If we're in the middle of programmatic navigation, don't interfere
    if (isNavigating) {
      console.log('Ignoring section change during navigation');
      return;
    }

    // Find the first CONTENT step in the new section (skip section headers)
    const stepsInSection = flatSteps.filter(step => step.sectionIndex === newSectionIndex);

    // Skip the first step if it's just the section header
    let firstContentStep = stepsInSection.find(step =>
      !step.label.startsWith('Section ') &&
      step.content &&
      step.content.trim() !== '' &&
      step.content !== step.label
    );

    // If no content step found, fall back to the first step after the section header
    if (!firstContentStep && stepsInSection.length > 1) {
      firstContentStep = stepsInSection[1];
    }

    // If still no step found, use the first step in the section
    if (!firstContentStep && stepsInSection.length > 0) {
      firstContentStep = stepsInSection[0];
    }

    if (firstContentStep) {
      const stepIndex = flatSteps.indexOf(firstContentStep);
      onStepChange(stepIndex, newSectionIndex);
      onNavigationUpdate(firstContentStep.label);
      console.log('Navigated to first content step in section:', firstContentStep.label);
    } else {
      console.warn('No steps found for section:', newSectionIndex);
    }
  }

  static handleRatingChanged(
    event: CustomEvent,
    onAnswerUpdate?: (questionId: string, value: any) => void
  ): void {
    const { questionId, value } = event.detail;
    console.log(`Question ${questionId} answered with: ${value}`);

    // Call the optional callback to update answers
    onAnswerUpdate?.(questionId, value);

    // Dispatch a custom event for parent components
    const answerEvent = new CustomEvent('efp-answer-changed', {
      detail: { questionId, value },
      bubbles: true,
      composed: true
    });

    event.target?.dispatchEvent(answerEvent);
  }
}

// Utility class for lifecycle management
class EFPLifecycleUtils {
  static handleStepIndexChange(
    currentStepIndex: number,
    flatSteps: EFPStep[],
    activeContent: EFPActiveContent,
    onContentUpdate: (newContent: EFPActiveContent) => void,
    onNavigationUpdate?: (label: string) => void
  ): boolean {
    const step = flatSteps[currentStepIndex];

    if (step && (activeContent.title !== step.label || activeContent.content !== step.content)) {
      const newContent: EFPActiveContent = {
        title: step.label,
        content: step.content,
      };

      onContentUpdate(newContent);
      onNavigationUpdate?.(step.label);

      return true; // Content was updated
    }

    return false; // No update needed
  }

  static handleSectionIndexChange(
    currentSectionIndex: number,
    tabGroupEl: any,
    onTabUpdate?: () => void
  ): void {
    if (tabGroupEl) {
      const activeTab = `section-${currentSectionIndex}`;
      tabGroupEl.show?.(activeTab);
      onTabUpdate?.();
    }
  }

  static shouldRequestUpdate(changedProps: Map<string, unknown>, watchedProps: string[]): boolean {
    return watchedProps.some(prop => changedProps.has(prop));
  }
}

@customElement('efp-entry-form')
class EFPEntryForm extends LitElement {
  @property({ type: Number }) currentSectionIndex = 0;
  @property({ type: Number }) currentStepIndex = 0;
  @property({ type: Array, attribute: false }) nestedChapterStructure: any[] = [];
  private isNavigating = false; // Flag to prevent tab change interference
  @property({ type: Object }) activeContent: EFPActiveContent = {
    title: 'Introduction to the Environmental Farm Plan (EFP)',
    content:
      'The purpose of the EFP is to assess the features and management of your farm to identify environmental risks and develop an action plan.',
  };
  @query('sl-tab-group') tabGroupEl!: HTMLElement & {
    show: (tabName: string) => void;
  };

  static styles = css`
    @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700&display=swap');
    @import url('https://cdn.jsdelivr.net/npm/@bcgov/bc-sans@2.0.0/css/BCSans.css');

    :host {
      font-family: 'BCSans', 'BC Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --chapter-font: 'Roboto Slab', Georgia, serif;
      --body-font: 'BCSans', 'BC Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Global font override for all content */
    :host *,
    :host *::before,
    :host *::after {
      font-family: var(--body-font) !important;
    }

    /* Specific overrides for headings */
    :host h1,
    :host h2,
    :host h3,
    :host h4,
    :host h5,
    :host h6 {
      font-family: var(--chapter-font) !important;
    }

    .container {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      min-height: 100vh;
      height: auto;
      font-family: var(--body-font);
    }

    /* Custom spacing for navigation collapsible containers */
    sl-details {
      margin-bottom: 0.75rem !important;
    }

    sl-details::part(base) {
      padding: 0.25rem !important;
    }

    sl-details::part(header) {
      padding: 0.5rem 0.75rem !important;
    }

    sl-details::part(content) {
      padding: 0.25rem 0.75rem 0.5rem 0.75rem !important;
    }

    /* Spacing for standalone navigation items after collapsible containers */
    .nav-subchapter-title {
      margin-top: 0.5rem !important;
    }

    /* Navigation container styling */
    .nav-container {
      margin-bottom: 0.5rem;
    }

    .nav-container-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--body-font);
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
    }

    .nav-container-header:hover {
      border-color: var(--sl-color-primary-300);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .nav-container-children {
      border-left: 2px solid var(--sl-color-neutral-200);
      padding-left: 0.5rem;
    }

    .sidebar {
      flex: 0 0 25%;
      padding: 1rem;
      border-right: 1px solid var(--sl-color-neutral-200);
      font-family: var(--body-font);
      min-height: 100vh;
    }

    .main-content {
      flex: 1;
      padding: 1rem;
      font-family: var(--body-font);
      min-height: 100vh;
    }

    @media (max-width: 992px) {
      .sidebar {
        order: 2;
        flex: 0 0 100%;
      }

      .main-content {
        order: 1;
        flex: 0 0 100%;
      }
    }

    .card {
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      padding: 1rem;
      margin-bottom: 1rem;
      background-color: var(--sl-color-neutral-0);
      font-family: var(--body-font);
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    sl-tab::part(base) {
      display: flex;
      align-items: center;
      font-family: var(--body-font);
      font-weight: 500;
    }

    .question-container {
      margin-bottom: 1.5rem;
      padding: 1.25rem;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background-color: var(--sl-color-neutral-50);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      font-family: var(--body-font);
    }

    .question-label {
      font-family: var(--chapter-font);
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
      line-height: 1.4;
      color: var(--sl-color-neutral-900);
    }

    .question-text {
      margin-bottom: 1rem;
      color: var(--sl-color-neutral-700);
      font-size: 0.95rem;
      line-height: 1.6;
      font-family: var(--body-font);
    }

    .chapter-header {
      background: linear-gradient(135deg, var(--sl-color-primary-50) 0%, var(--sl-color-primary-100) 100%);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-radius: var(--sl-border-radius-medium);
      border-left: 4px solid var(--sl-color-primary-600);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .chapter-header h3 {
      font-family: var(--chapter-font);
      font-weight: 700;
      font-size: 1.75rem;
      color: var(--sl-color-primary-900);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.025em;
    }

    .subchapter-header {
      background: linear-gradient(135deg, var(--sl-color-neutral-100) 0%, var(--sl-color-neutral-150) 100%);
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: var(--sl-border-radius-small);
      border-left: 3px solid var(--sl-color-neutral-500);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }

    .subchapter-header h4 {
      font-family: var(--chapter-font);
      font-weight: 600;
      font-size: 1.35rem;
      color: var(--sl-color-neutral-800);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.015em;
    }

    .sub-subchapter-header {
      background: linear-gradient(135deg, var(--sl-color-neutral-50) 0%, var(--sl-color-neutral-100) 100%);
      padding: 0.75rem;
      margin: 1rem 0 1rem 1rem;
      border-radius: var(--sl-border-radius-small);
      border-left: 2px solid var(--sl-color-neutral-400);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .sub-subchapter-header h5 {
      font-family: var(--chapter-font);
      font-weight: 500;
      font-size: 1.15rem;
      color: var(--sl-color-neutral-700);
      margin: 0 0 0.5rem 0;
    }

    .container-message {
      background: linear-gradient(135deg, var(--sl-color-neutral-50) 0%, var(--sl-color-neutral-100) 100%);
      padding: 2rem;
      margin: 2rem 0;
      border-radius: var(--sl-border-radius-medium);
      border: 1px solid var(--sl-color-neutral-200);
      text-align: center;
    }

    .container-message h3 {
      font-family: var(--chapter-font);
      font-weight: 600;
      font-size: 1.25rem;
      color: var(--sl-color-neutral-700);
      margin: 0 0 1rem 0;
    }

    .container-message p {
      font-family: var(--body-font);
      color: var(--sl-color-neutral-600);
      margin: 0;
      line-height: 1.5;
    }

    .question-response {
      margin-top: 1rem;
      font-family: var(--body-font);
    }

    /* Navigation styling */
    .nav-chapter-title {
      font-family: var(--chapter-font);
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--sl-color-neutral-800);
    }

    .nav-subchapter-title {
      font-family: var(--body-font);
      font-weight: 500;
      font-size: 0.9rem;
      color: var(--sl-color-neutral-700);
    }

    /* Content area typography */
    .chapter-content h3,
    .subchapter-content h3 {
      font-family: var(--chapter-font) !important;
      font-weight: 600;
      color: var(--sl-color-neutral-800);
      margin-bottom: 0.75rem;
    }

    .chapter-content p,
    .subchapter-content p {
      font-family: var(--body-font) !important;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
    }

    /* Question content styling - override any inherited fonts */
    .main-content,
    .main-content *,
    .main-content p,
    .main-content div,
    .main-content span,
    .main-content label,
    .main-content input,
    .main-content textarea,
    .main-content select {
      font-family: var(--body-font) !important;
    }

    /* Ensure question text uses BC Sans */
    .main-content h1,
    .main-content h2,
    .main-content h3,
    .main-content h4,
    .main-content h5,
    .main-content h6 {
      font-family: var(--chapter-font) !important;
    }

    /* Radio buttons and form elements */
    .main-content input[type="radio"],
    .main-content input[type="checkbox"],
    .main-content input[type="text"],
    .main-content textarea,
    .main-content select {
      font-family: var(--body-font) !important;
    }

    /* Question labels and text */
    .main-content .question-label,
    .main-content .question-text {
      font-family: var(--body-font) !important;
    }

    /* Override any external stylesheets for question content */
    .main-content [data-question-content],
    .main-content [data-question-content] *,
    .main-content .question-container,
    .main-content .question-container * {
      font-family: var(--body-font) !important;
    }

    /* Specific overrides for common question elements */
    .main-content strong,
    .main-content b,
    .main-content em,
    .main-content i,
    .main-content span,
    .main-content div {
      font-family: inherit !important;
    }


  `;

  private get sections(): EFPSection[] {
    return [
    {
      tab: 'Section A',
      title: 'Farm Business Profile',
      items: [
        {
          label: 'Farm Business Name',
          content: `
          <h3>Farm Business Name</h3>
          <p>Please enter the legal name under which your farm operates. This should match your tax documents and business registration.</p>
          <p>If your farm uses a different operating name or DBA ("doing business as"), include that as well.</p>
        `,
          complete: true,
        },
        {
          label: 'Ownership Details',
          content: `
          <h3>Ownership Details</h3>
          <p>Provide details about the ownership structure of your farm.</p>
          <ul>
            <li>Is the farm owned by an individual, partnership, or corporation?</li>
            <li>List all owners and their roles.</li>
            <li>Indicate who is responsible for daily operations and environmental decision-making.</li>
          </ul>
        `,
          complete: false,
        },
        {
          label: 'Nested Section: Certifications',
          title: 'Nested Section: Certifications',
          items: [
            {
              label: 'Organic Certification',
              content: `
              <h3>Organic Certification</h3>
              <p>This section documents your organic certification status.</p>
              <p>Certified by: <strong>Pacific Organic Growers (POG)</strong></p>
              <p>Include your certificate number and expiration date, and upload supporting documentation if available.</p>
            `,
              complete: true,
            },
            {
              label: 'Other Accreditation',
              content: `
              <h3>Other Environmental or Farm Certifications</h3>
              <p>If your farm has additional certifications such as:</p>
              <ul>
                <li>Environmental Farm Stewardship</li>
                <li>Salmon Safe</li>
                <li>Bee-Friendly Farming</li>
              </ul>
              <p>Provide issuing organization, validity period, and documentation.</p>
            `,
              complete: false,
            },
          ],
        },
      ],
    },
    {
      tab: 'Section B',
      title: 'Environmental Farm Plan Questionnaire',
      items: EFPSectionGenerator.generateSectionBItems(this.nestedChapterStructure),
    },
    {
      tab: 'Section C',
      title: 'Field Review',
      items: [
        {
          label: 'Soil Type',
          content: `
          <h3>Soil Type and Characteristics</h3>
          <p>Identify the dominant soil types across your fields.</p>
          <ul>
            <li>Include texture (e.g., loam, clay, sandy loam)</li>
            <li>Note any known drainage or compaction issues</li>
            <li>Attach soil maps or reports if available</li>
          </ul>
        `,
          complete: false,
        },
        {
          label: 'Erosion Risk',
          content: `
          <h3>Erosion Risk Assessment</h3>
          <p>Evaluate your fields for signs and risk of soil erosion.</p>
          <p>Factors to consider:</p>
          <ul>
            <li>Slope and topography</li>
            <li>Crop residue or cover crop practices</li>
            <li>History of water or wind erosion</li>
          </ul>
          <p>List any mitigation strategies currently in use, such as grassed waterways or windbreaks.</p>
        `,
          complete: false,
        },
      ],
    },
  ];
  }

  // Rendering methods
  private renderQuestion(question: any) {
    const questionTypeMap: { [key: number]: string } = {
      100000000: 'Yes/No/NA',
      100000001: 'Point Rating',
      // Add more question types as needed
    };

    const questionTypeName = questionTypeMap[question.questionType] || 'Unknown';

    return html`
      <div class="question-container">
        ${question.textAboveQuestion ? html`
          <div class="question-text">
            ${unsafeHTML(question.textAboveQuestion)}
          </div>
        ` : ''}

        <div class="question-label">
          ${unsafeHTML(question.label)}
        </div>

        ${question.textBelowQuestion ? html`
          <div class="question-text">
            ${unsafeHTML(question.textBelowQuestion)}
          </div>
        ` : ''}

        <div class="question-response">
          ${this.renderQuestionInput(question, questionTypeName)}
        </div>
      </div>
    `;
  }

  private renderQuestionInput(question: any, questionType: string) {
    switch (questionType) {
      case 'Yes/No/NA':
      case 'Point Rating':
        return html`
          <rating-question
            .questionId=${question.id}
            .questionType=${questionType}
            @rating-changed=${this.handleRatingChanged}
          ></rating-question>
        `;

      default:
        return html`
          <sl-textarea
            label="Your response"
            name="question-${question.id}"
            rows="3"
            placeholder="Enter your response..."
          ></sl-textarea>
        `;
    }
  }

  private renderSubchapter(subchapter: any) {
    return html`
      ${subchapter.description ? html`
        <div class="subchapter-header">
          <div>${unsafeHTML(subchapter.description)}</div>
        </div>
      ` : ''}
      ${subchapter.questions.map((question: any) => this.renderQuestion(question))}

      ${subchapter.subchapters ? subchapter.subchapters.map((subSubchapter: any) => this.renderSubSubchapter(subSubchapter)) : ''}
    `;
  }

  private renderSubSubchapter(subSubchapter: any) {
    return html`
      ${subSubchapter.description ? html`
        <div class="sub-subchapter-header">
          <div>${unsafeHTML(subSubchapter.description)}</div>
        </div>
      ` : ''}

      ${subSubchapter.questions.map((question: any) => this.renderQuestion(question))}
    `;
  }

  private renderChapter(chapter: any) {
    return html`
      ${chapter?.description ? html`
        <div class="chapter-header">
          <div>${unsafeHTML(chapter.description)}</div>
        </div>
      ` : ''}

      ${chapter?.questions ? chapter.questions.map((question: any) => this.renderQuestion(question)) : ''}

      ${chapter?.subchapters ? chapter.subchapters.map((subchapter: any) => this.renderSubchapter(subchapter)) : ''}
    `;
  }





  private renderMainContent() {
    return EFPRenderUtils.renderMainContent(
      this.currentSectionIndex,
      this.flatSteps,
      this.currentStepIndex,
      this.activeContent,
      html,
      unsafeHTML,
      (subchapterData: any) => this.renderSubchapter(subchapterData),
      (chapterData: any) => this.renderChapter(chapterData)
    );
  }

  // Public API methods
  public updateNestedChapterStructure(nestedStructure: any[]) {
    EFPLogger.log('updateNestedChapterStructure called with', nestedStructure?.length || 0, 'chapters');

    this.nestedChapterStructure = nestedStructure;

    // The @property decorator will automatically trigger a re-render
    // But we can force it to be sure
    this.requestUpdate();
  }

  // Computed properties
  private get completionPercent(): number {
    return EFPCompletionUtils.calculateOverallCompletion(this.sections);
  }

  // Navigation methods
  private goToNext() {
    EFPLogger.log('goToNext called, current step:', this.currentStepIndex, this.flatSteps[this.currentStepIndex]?.label);

    // Handle case where currentStepIndex is -1 (step not found in flatSteps)
    if (this.currentStepIndex === -1) {
      EFPLogger.warn('currentStepIndex is -1, trying to find current step by activeContent title');
      const foundIndex = this.flatSteps.findIndex(step => step.label === this.activeContent.title);
      if (foundIndex !== -1) {
        EFPLogger.log(`Found current step "${this.activeContent.title}" at index ${foundIndex}`);
        this.currentStepIndex = foundIndex;
      } else {
        EFPLogger.error(`Could not find current step "${this.activeContent.title}" in flatSteps`);
        return; // Don't proceed with navigation if we can't find current position
      }
    }

    if (this.currentStepIndex < this.flatSteps.length - 1) {
      let nextIndex = this.currentStepIndex + 1;

      // Skip over container items and find the next selectable item
      while (nextIndex < this.flatSteps.length) {
        const nextStep = this.flatSteps[nextIndex];

        // Check if this step is a container (non-selectable)
        const isContainer = EFPNavigationUtils.isStepContainer(nextStep, this.sections);

        if (!isContainer) {
          // Found a selectable step
          EFPLogger.log('Found selectable step:', nextStep.label, 'at index', nextIndex);

          const currentStep = this.flatSteps[this.currentStepIndex];
          const currentSectionIndex = currentStep.sectionIndex;

          // Check if this is cross-section navigation (going to next section)
          if (nextStep.sectionIndex > currentSectionIndex) {
            console.log(`Cross-section navigation detected: going from section ${currentSectionIndex} to section ${nextStep.sectionIndex}`);

            // Find the FIRST selectable step in the next section
            const firstStepInNextSection = EFPNavigationUtils.findFirstSelectableStepInSection(nextStep.sectionIndex, this.flatSteps, this.sections);
            if (firstStepInNextSection) {
              console.log(`Navigating to first step in section ${nextStep.sectionIndex}: "${firstStepInNextSection.step.label}"`);

              // Set navigation flag to prevent tab change interference
              this.isNavigating = true;

              this.currentStepIndex = firstStepInNextSection.index;
              this.currentSectionIndex = firstStepInNextSection.step.sectionIndex;

              // Update the active content
              this.activeContent = {
                title: firstStepInNextSection.step.label,
                content: firstStepInNextSection.step.content,
              };

              // Update navigation state to expand relevant containers
              this.updateNavigationState(firstStepInNextSection.step.label);

              // Clear navigation flag after a brief delay
              setTimeout(() => {
                this.isNavigating = false;
              }, 100);

              // Force a re-render
              this.requestUpdate();
              return;
            }
          }

          // Regular same-section navigation
          this.isNavigating = true;

          this.currentStepIndex = nextIndex;
          this.currentSectionIndex = nextStep.sectionIndex;

          // Immediately update the active content
          this.activeContent = {
            title: nextStep.label,
            content: nextStep.content,
          };

          // Update navigation state to expand relevant containers
          this.updateNavigationState(nextStep.label);

          // Clear navigation flag after a brief delay
          setTimeout(() => {
            this.isNavigating = false;
          }, 100);

          // Force a re-render
          this.requestUpdate();
          return;
        }

        nextIndex++;
      }

      // If we didn't find any selectable steps, just go to the last step
      if (nextIndex >= this.flatSteps.length && this.currentStepIndex < this.flatSteps.length - 1) {
        EFPLogger.log('No more selectable steps found, going to last step');
        this.currentStepIndex = this.flatSteps.length - 1;
        this.currentSectionIndex = this.flatSteps[this.currentStepIndex].sectionIndex;
      }
    }
  }



  // Navigation event handlers
  private handleNavigationPrevious() {
    this.goToPrevious();
  }

  private handleNavigationSkip(event: CustomEvent) {
    this.currentSectionIndex = event.detail.sectionIndex;
  }

  private handleNavigationContinue() {
    this.goToNext();
  }

  // Section navigation event handler
  private handleSectionChange(newSectionIndex: number) {
    EFPEventUtils.handleSectionChange(
      newSectionIndex,
      this.isNavigating,
      this.flatSteps,
      (stepIndex: number, sectionIndex: number) => {
        this.currentStepIndex = stepIndex;
        this.currentSectionIndex = sectionIndex;

        // Update the active content
        const step = this.flatSteps[stepIndex];
        if (step) {
          this.activeContent = {
            title: step.label,
            content: step.content,
          };
        }

        // Force a re-render
        this.requestUpdate();
      },
      (label: string) => this.updateNavigationState(label)
    );
  }

  // Question interaction event handler
  private handleRatingChanged(event: CustomEvent) {
    EFPEventUtils.handleRatingChanged(
      event,
      (questionId: string, value: any) => {
        // Store the answer in your data model if needed
        // For example: this.answers[questionId] = value;
        EFPLogger.log(`Storing answer for question ${questionId}: ${value}`);
      }
    );
  }

  // Navigation item click event handler
  private handleItemClick(item: EFPSectionItem) {
    EFPEventUtils.handleItemClick(
      item,
      this.flatSteps,
      (stepIndex: number, sectionIndex: number) => {
        this.currentStepIndex = stepIndex;
        this.currentSectionIndex = sectionIndex;
      },
      (label: string) => this.updateNavigationState(label)
    );


  }

  // Utility methods
  private updateNavigationState(currentLabel: string) {
    // Find all sl-details elements in the navigation
    const allDetails = this.shadowRoot?.querySelectorAll('sl-details');
    if (!allDetails) return;

    // First, close all details
    allDetails.forEach(detail => {
      detail.open = false;
    });

    // Find which containers should be open based on the current item
    const containersToOpen = EFPNavigationUtils.findContainersForItem(currentLabel, this.sections);

    // Open the relevant containers
    allDetails.forEach(detail => {
      const summary = detail.getAttribute('summary');
      if (summary && containersToOpen.includes(summary)) {
        detail.open = true;
      }
    });
  }

  private goToPrevious() {
    EFPLogger.log('goToPrevious called, current step:', this.currentStepIndex, this.flatSteps[this.currentStepIndex]?.label);

    // Handle case where currentStepIndex is -1 (step not found in flatSteps)
    if (this.currentStepIndex === -1) {
      EFPLogger.warn('currentStepIndex is -1, trying to find current step by activeContent title');
      const foundIndex = this.flatSteps.findIndex(step => step.label === this.activeContent.title);
      if (foundIndex !== -1) {
        EFPLogger.log(`Found current step "${this.activeContent.title}" at index ${foundIndex}`);
        this.currentStepIndex = foundIndex;
      } else {
        EFPLogger.error(`Could not find current step "${this.activeContent.title}" in flatSteps`);
        return; // Don't proceed with navigation if we can't find current position
      }
    }

    if (this.currentStepIndex > 0) {
      const currentStep = this.flatSteps[this.currentStepIndex];
      const currentSectionIndex = currentStep.sectionIndex;

      // Check if we need to do cross-section navigation
      // Look for the immediate previous step to see if it's in a different section
      let prevIndex = this.currentStepIndex - 1;

      // Skip over container items to find the actual previous selectable step
      while (prevIndex >= 0) {
        const prevStep = this.flatSteps[prevIndex];
        const isContainer = EFPNavigationUtils.isStepContainer(prevStep, this.sections);

        if (!isContainer) {
          // Found a selectable previous step
          console.log(`Found previous selectable step: "${prevStep.label}" at index ${prevIndex}, section ${prevStep.sectionIndex}`);

          // Check if this step is in a different section (cross-section navigation)
          if (prevStep.sectionIndex < currentSectionIndex) {
            console.log(`Cross-section navigation detected: going from section ${currentSectionIndex} to section ${prevStep.sectionIndex}`);

            // Find the LAST selectable step in the previous section
            const lastStepInPrevSection = EFPNavigationUtils.findLastSelectableStepInSection(prevStep.sectionIndex, this.flatSteps, this.sections);
            if (lastStepInPrevSection) {
              console.log(`Navigating to last step in section ${prevStep.sectionIndex}: "${lastStepInPrevSection.step.label}"`);

              // Set navigation flag to prevent tab change interference
              this.isNavigating = true;

              this.currentStepIndex = lastStepInPrevSection.index;
              this.currentSectionIndex = lastStepInPrevSection.step.sectionIndex;

              // Update the active content
              this.activeContent = {
                title: lastStepInPrevSection.step.label,
                content: lastStepInPrevSection.step.content,
              };

              // Update navigation state to expand relevant containers
              this.updateNavigationState(lastStepInPrevSection.step.label);

              // Clear navigation flag after a brief delay
              setTimeout(() => {
                this.isNavigating = false;
              }, 100);

              // Force a re-render
              this.requestUpdate();
              return;
            }
          }

          // Regular same-section navigation
          this.isNavigating = true;

          this.currentStepIndex = prevIndex;
          this.currentSectionIndex = prevStep.sectionIndex;

          // Update the active content
          this.activeContent = {
            title: prevStep.label,
            content: prevStep.content,
          };

          // Update navigation state to expand relevant containers
          this.updateNavigationState(prevStep.label);

          // Clear navigation flag after a brief delay
          setTimeout(() => {
            this.isNavigating = false;
          }, 100);

          // Force a re-render
          this.requestUpdate();
          return;
        }

        prevIndex--;
      }

      // If we didn't find any selectable steps, just go to the first step
      if (prevIndex < 0 && this.currentStepIndex > 0) {
        this.currentStepIndex = 0;
        this.currentSectionIndex = this.flatSteps[0].sectionIndex;
      }
    }
  }

  private get flatSteps(): EFPStep[] {
    const result: EFPStep[] = [];

    const collect = (items: any[], sectionIndex: number) => {
      for (const item of items) {
        if ('items' in item) {
          // This is a parent item with nested items (like a chapter with subchapters)
          result.push({
            label: item.label, // Use item.label which contains the chapter name
            content: item.content || '',
            sectionIndex,
            chapterData: item.chapterData, // Preserve chapter data
          });
          collect(item.items, sectionIndex);
        } else {
          const stepItem: any = {
            label: item.label,
            content: item.content ?? '',
            complete: item.complete ?? false,
            sectionIndex,
          };

          // Add chapter data if it exists (for main chapters)
          if (item.chapterData) {
            stepItem.chapterData = item.chapterData;
          }

          // Add subchapter data if it exists (for subchapters)
          if (item.subchapterData) {
            stepItem.subchapterData = item.subchapterData;
          }

          result.push(stepItem);
        }
      }
    };

    this.sections.forEach((section, index) => {
      result.push({
        label: section.tab,
        content: section.title,
        sectionIndex: index,
      });
      collect(section.items, index);
    });

    return result;
  }

  private isSectionComplete(section: EFPSection): boolean {
    return EFPCompletionUtils.isSectionComplete(section);
  }

  private initializeToFirstSelectableStep() {
    // Only initialize if we have sections and steps available
    if (!this.sections || this.sections.length === 0 || !this.flatSteps || this.flatSteps.length === 0) {
      console.log('Sections or steps not ready yet, skipping initialization');
      return;
    }

    // Find the first selectable step in the first section
    const firstSelectableStep = EFPNavigationUtils.findFirstSelectableStepInSection(
      0, // First section
      this.flatSteps,
      this.sections
    );

    if (firstSelectableStep) {
      console.log('Initializing to first selectable step:', firstSelectableStep.step.label);
      this.currentStepIndex = firstSelectableStep.index;
      this.currentSectionIndex = 0;

      // Update active content
      this.activeContent = {
        title: firstSelectableStep.step.label,
        content: firstSelectableStep.step.content,
      };

      // Update navigation state
      this.updateNavigationState(firstSelectableStep.step.label);
    } else {
      console.log('No selectable step found, keeping default initialization');
      // Keep the default initialization (currentStepIndex = 0, currentSectionIndex = 0)
    }
  }



  private handleBreadcrumbNavigation(event: CustomEvent) {
    const { type, data } = event.detail;

    switch (type) {
      case 'home':
        this.navigateToHome();
        break;
      case 'section':
        this.navigateToSection(data.sectionIndex);
        break;
      case 'hierarchy':
        this.navigateToHierarchyItem(data.targetLabel);
        break;
    }
  }

  private navigateToHome() {
    // Navigate to first selectable step in first section
    const firstSelectableStep = EFPNavigationUtils.findFirstSelectableStepInSection(
      0, // First section
      this.flatSteps,
      this.sections
    );

    if (firstSelectableStep) {
      this.currentStepIndex = firstSelectableStep.index;
      this.currentSectionIndex = 0;

      // Update active content
      this.activeContent = {
        title: firstSelectableStep.step.label,
        content: firstSelectableStep.step.content,
      };

      // Update navigation state
      this.updateNavigationState(firstSelectableStep.step.label);
      this.requestUpdate();
    } else {
      // Fallback to first step
      this.currentStepIndex = 0;
      this.currentSectionIndex = 0;
      this.requestUpdate();
    }
  }

  private navigateToSection(sectionIndex: number) {
    console.log('Breadcrumb: Navigating to section', sectionIndex);

    // Navigate to first selectable step in section using the navigation utility
    const firstSelectableStep = EFPNavigationUtils.findFirstSelectableStepInSection(
      sectionIndex,
      this.flatSteps,
      this.sections
    );

    if (firstSelectableStep) {
      console.log('Breadcrumb: Found first selectable step:', firstSelectableStep.step.label);
      this.currentStepIndex = firstSelectableStep.index;
      this.currentSectionIndex = sectionIndex;

      // Update active content
      this.activeContent = {
        title: firstSelectableStep.step.label,
        content: firstSelectableStep.step.content,
      };

      // Update navigation state
      this.updateNavigationState(firstSelectableStep.step.label);
      this.requestUpdate();
    } else {
      console.log('Breadcrumb: No selectable step found, using fallback');
      // Fallback: navigate to first step in section even if it's a container
      const firstStepInSection = this.flatSteps.find(step => step.sectionIndex === sectionIndex);
      if (firstStepInSection) {
        const stepIndex = this.flatSteps.indexOf(firstStepInSection);
        console.log('Breadcrumb: Fallback to step:', firstStepInSection.label, 'at index:', stepIndex);
        this.currentStepIndex = stepIndex;
        this.currentSectionIndex = sectionIndex;
        this.activeContent = {
          title: firstStepInSection.label,
          content: firstStepInSection.content,
        };
        this.requestUpdate();
      }
    }
  }

  private navigateToHierarchyItem(targetLabel: string) {
    // Find and navigate to this hierarchy level
    const hierarchyStepIndex = this.flatSteps.findIndex(step => step.label === targetLabel);
    if (hierarchyStepIndex !== -1) {
      const hierarchyStep = this.flatSteps[hierarchyStepIndex];
      this.currentStepIndex = hierarchyStepIndex;
      this.currentSectionIndex = hierarchyStep.sectionIndex;

      // Update active content
      this.activeContent = {
        title: hierarchyStep.label,
        content: hierarchyStep.content,
      };

      // Update navigation state
      this.updateNavigationState(hierarchyStep.label);
      this.requestUpdate();
    }
  }

  private renderItems(items: EFPSectionItem[]): unknown {
    return EFPRenderUtils.renderItems(
      items,
      html,
      this.activeContent.title,
      (item: EFPSectionItem) => this.handleItemClick(item),
      (items: EFPSectionItem[]) => this.renderItems(items)
    );
  }





  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('currentStepIndex')) {
      EFPLifecycleUtils.handleStepIndexChange(
        this.currentStepIndex,
        this.flatSteps,
        this.activeContent,
        (newContent: EFPActiveContent) => {
          this.activeContent = newContent;
        },
        (label: string) => this.updateNavigationState(label)
      );


    }

    if (changedProps.has('currentSectionIndex')) {
      EFPLifecycleUtils.handleSectionIndexChange(
        this.currentSectionIndex,
        this.tabGroupEl
      );
    }
  }

  // Lifecycle methods
  firstUpdated() {
    // Initialize to the first selectable step instead of potentially a section header
    this.initializeToFirstSelectableStep();
  }

  willUpdate(changedProps: Map<string, unknown>) {
    if (changedProps.has('currentStepIndex')) {
      EFPLifecycleUtils.handleStepIndexChange(
        this.currentStepIndex,
        this.flatSteps,
        this.activeContent,
        (newContent: EFPActiveContent) => {
          this.activeContent = newContent;
        }
      );
    }
  }

  render() {
    return html`
      <div class="container">
        <!-- Sidebar -->
        <aside class="sidebar">
          <div class="card">
            <div><strong>EFP Workbook:</strong> Test</div>
            <div><strong>Status:</strong> In Progress</div>
          </div>

          <sl-tab-group
            .activeTab=${`section-${this.currentSectionIndex}`}
            @sl-tab-show=${(e: CustomEvent) => {
              const tabIndex = parseInt(e.detail.name.replace('section-', ''));
              this.handleSectionChange(tabIndex);
            }}
          >
            ${this.sections.map((section, index) => {
              const isActive = index === this.currentSectionIndex;
              const isComplete = this.isSectionComplete(section);
              const icon = isComplete ? 'check-circle' : 'pencil';
              const color = isActive ? 'orange' : isComplete ? 'green' : 'gray';

              return html`
                <sl-tab slot="nav" panel="section-${index}">
                  <sl-icon
                    name=${icon}
                    style="color: ${color}; margin-right: 0.5rem;"
                  ></sl-icon>
                  <span style=${isActive ? 'font-weight: bold;' : ''}
                    >${section.tab}</span
                  >
                </sl-tab>
              `;
            })}
            ${this.sections.map(
              (section, index) => html`
                <sl-tab-panel name="section-${index}">
                  <div class="card">
                    <strong>${section.title}</strong>
                  </div>
                  ${this.renderItems(section.items)}
                </sl-tab-panel>
              `
            )}
          </sl-tab-group>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
          <div class="card">
            <strong>${this.completionPercent}% Complete</strong>
            <sl-progress
              .value=${this.completionPercent}
              max="100"
            ></sl-progress>
          </div>

          <!-- Navigation buttons above content -->
          <navigation-buttons
            .isPreviousDisabled=${this.currentStepIndex === 0}
            .isContinueDisabled=${this.currentStepIndex >= this.flatSteps.length - 1}
            .sectionsLength=${this.sections.length}
            @previous-clicked=${this.handleNavigationPrevious}
            @skip-clicked=${this.handleNavigationSkip}
            @continue-clicked=${this.handleNavigationContinue}
          ></navigation-buttons>

          <div class="card">
            <efp-breadcrumbs
              .currentStep=${this.flatSteps[this.currentStepIndex]}
              .currentSection=${this.sections[this.currentSectionIndex]}
              .currentSectionIndex=${this.currentSectionIndex}
              .currentStepIndex=${this.currentStepIndex}
              .flatSteps=${this.flatSteps}
              .sections=${this.sections}
              @breadcrumb-navigate=${this.handleBreadcrumbNavigation}
            ></efp-breadcrumbs>
            <h2>${this.activeContent.title}</h2>
            ${this.renderMainContent()}
          </div>

          <!-- Navigation buttons below content -->
          <navigation-buttons
            .isPreviousDisabled=${this.currentStepIndex === 0}
            .isContinueDisabled=${this.currentStepIndex >= this.flatSteps.length - 1}
            .sectionsLength=${this.sections.length}
            @previous-clicked=${this.handleNavigationPrevious}
            @skip-clicked=${this.handleNavigationSkip}
            @continue-clicked=${this.handleNavigationContinue}
          ></navigation-buttons>
        </main>
      </div>
    `;
  }
}
