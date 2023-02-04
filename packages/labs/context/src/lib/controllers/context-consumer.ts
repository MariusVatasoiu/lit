/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  ContextCallback,
  ContextRequestEvent,
} from '../context-request-event.js';
import {Context, ContextType} from '../create-context.js';
import {ReactiveController, ReactiveElement} from 'lit';

export interface Options<C extends Context<unknown, unknown>> {
  context: C;
  callback?: (value: ContextType<C>, dispose?: () => void) => void;
  subscribe?: boolean;
}

/**
 * ContextConsumer is a ReactiveController which binds a custom-element's
 * lifecycle to the Context API. When an element is connected to the DOM it
 * will emit the context-request event, invoking the callback set on the
 * controller when the context request is satisfied. It will also call
 * the dispose method provided by the Context API when the element is
 * disconnected.
 */
export class ContextConsumer<
  C extends Context<unknown, unknown>,
  HostElement extends ReactiveElement
> implements ReactiveController
{
  protected host: HostElement;
  private context: C;
  private callback?: (value: ContextType<C>, dispose?: () => void) => void;
  private subscribe = false;

  private provided = false;

  public value?: ContextType<C> = undefined;

  constructor(host: HostElement, options: Options<C>);
  /** @deprecated Use new ContextConsumer(host, options) */
  constructor(
    host: HostElement,
    context: C,
    callback?: (value: ContextType<C>, dispose?: () => void) => void,
    subscribe?: boolean
  );
  constructor(
    host: HostElement,
    contextOrOptions: C | Options<C>,
    callback?: (value: ContextType<C>, dispose?: () => void) => void,
    subscribe?: boolean
  ) {
    this.host = host;
    // This is a potentially fragile duck-type. It means a context object can't
    // have a property name context and be used in positional argument form.
    if ((contextOrOptions as Options<C>).context !== undefined) {
      const options = contextOrOptions as Options<C>;
      this.context = options.context;
      this.callback = options.callback;
      this.subscribe = options.subscribe ?? false;
    } else {
      this.context = contextOrOptions as C;
      this.callback = callback;
      this.subscribe = subscribe ?? false;
    }
    this.host.addController(this);
  }

  private unsubscribe?: () => void;

  hostConnected(): void {
    this.dispatchRequest();
  }

  hostDisconnected(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  private dispatchRequest() {
    this.host.dispatchEvent(
      new ContextRequestEvent(this.context, this._callback, this.subscribe)
    );
  }

  // This function must have stable identity to properly dedupe in ContextRoot
  // if this element connects multiple times.
  private _callback: ContextCallback<ContextType<C>> = (value, unsubscribe) => {
    // some providers will pass an unsubscribe function indicating they may provide future values
    if (this.unsubscribe) {
      // if the unsubscribe function changes this implies we have changed provider
      if (this.unsubscribe !== unsubscribe) {
        // cleanup the old provider
        this.provided = false;
        this.unsubscribe();
      }
      // if we don't support subscription, immediately unsubscribe
      if (!this.subscribe) {
        this.unsubscribe();
      }
    }

    // store the value so that it can be retrieved from the controller
    this.value = value;
    // schedule an update in case this value is used in a template
    this.host.requestUpdate();

    // only invoke callback if we are either expecting updates or have not yet
    // been provided a value
    if (!this.provided || this.subscribe) {
      this.provided = true;
      if (this.callback) {
        this.callback(value, unsubscribe);
      }
    }

    this.unsubscribe = unsubscribe;
  };
}
