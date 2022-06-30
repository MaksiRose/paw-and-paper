"use strict";
// @ts-check
/**
 * Goes through all components in a message and disables them.
 * @param {Array<import('discord.js').MessageActionRow>} messageComponents
 * @returns {Array<import('discord.js').MessageActionRow>}
 */
function disableAllComponents(messageComponents) {
    for (const actionRow of messageComponents) {
        for (const component of actionRow.components) {
            if (component.type === 'BUTTON' && component.style === 'LINK') {
                continue;
            }
            component.disabled = true;
        }
    }
    return messageComponents;
}
module.exports = disableAllComponents;
