/*
  Helper Functions
 */
  function debounce(fn, delay = 250) {
    let timer;
    return function(...args) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        fn(...args);
        timer = null;
      }, delay);
    };
  }
  
  function $(selector, context = document) {
    return context.querySelector(selector);
  }
  
  function $all(selector, context = document) {
    return context.querySelectorAll(selector);
  }
  
  const createElement = (tagName, attributes = {}, ...children) => {
    const node = document.createElement(tagName);
  
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        if (key === "className") {
          const classes = attributes[key].split(" ");
          classes.forEach(x => node.classList.add(x));
        } else if (/^data-/.test(key)) {
          const dataProp = key
            .slice(5) // removes `data-`
            .split("-")
            .map(
              (str, i) =>
                i === 0
                  ? str
                  : str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
            )
            .join("");
          node.dataset[dataProp] = attributes[key];
        } else {
          node.setAttribute(key, attributes[key]);
        }
      });
    }
  
    children.forEach(child => {
      if (typeof child === "undefined" || child === null) {
        return;
      }
      if (typeof child === "string") {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    });
  
    return node;
  };
  
  const editor_plugin = (function() {
    const def = {
      id: "",
      defParagraphSeparator: "p",
      parentSelector: "body",
      actions: {
        bold: {
          type: "strong",
          icon: "bold",
          format: "inline",
          command: "bold"
        },
        italic: {
          type: "em",
          icon: "italic",
          format: "inline",
          command: "italic"
        },
        underline: {
          type: "u",
          icon: "underline",
          format: "inline",
          command: "underline"
        },
        highlight: {
          type: "mark",
          icon: "highlight",
          format: "inline",
          command: "hiliteColor",
          value: "#ffe066"
        },
        olist: {
          type: "ol",
          icon: "list-ol",
          format: "block",
          command: "insertOrderedList"
        },
        ulist: {
          type: "ul",
          icon: "list-ul",
          format: "block",
          command: "insertUnorderedList"
        },
        link: {
          type: "a",
          icon: "link",
          format: "inline",
          command: "createLink"
        }         
      },
      inlineActionKeys: ["bold", "italic", "underline", "link"],
      blockActionKeys: ["olist", "ulist"]
    };
  
    class RichEditor {
      constructor(settings) {
        this.settings = {
          ...def,
          ...settings
        };
        this.state = {
          currentSelection: null,
          currentBlock: {
            index: 0,
            type: settings.defParagraphSeparator || def.defParagraphSeparator,
            text: ""
          },
          selectedBlockType: settings.defParagraphSeparator || "p"
        };
        this.keyCodes = {
          BACKSPACE: 8,
          DELETE: 46,
          TAB: 9,
          ENTER: 13
        };
        this.el = {
          parent: $(settings.parentSelector) || document.body,
          iframe: $(`#${settings.id}`) || this.renderEditor()
        };
        this.showSelectedBlockType = this.showSelectedBlockType.bind(this);
        this.showSelectedInlineStyles = this.showSelectedInlineStyles.bind(this);
        this.init();
      }
  
      init() {
        this.el = {
          ...this.el,
          doc: $(`#${this.settings.id}`).contentWindow.document
        };
        const defParaSeparator = this.settings.defParagraphSeparator;
        this.el.doc.head.appendChild(createElement('style', {
          type: 'text/css'
        }, `body{ font-family:arial; font-size:14px;}a{cursor: pointer}`));
        this.el.doc.body.setAttribute('contenteditable', "true");
        this.el.doc.execCommand(
          "defaultParagraphSeparator",
          false,
          this.settings.defParagraphSeparator
        );
        this.el.doc.addEventListener("keyup", () => this.displayHTML(), false);
  
        this.el.doc.body.addEventListener("input", () => {
          const firstChild = this.el.doc.body.firstChild;
          if (!firstChild || firstChild.nodeType !== 3) return;
          const range = document.createRange();
          range.selectNodeContents(firstChild);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          this.editText(
            "formatBlock",
            `<${this.settings.defParagraphSeparator}>`
          );
        });
  
        this.el.doc.body.addEventListener("keyup", this.showSelectedBlockType);
        this.el.doc.body.addEventListener("mouseup", this.showSelectedBlockType);
        this.el.doc.body.addEventListener(
          "mouseup",
          this.showSelectedInlineStyles
        );
        this.el.doc.body.addEventListener("keyup", this.showSelectedInlineStyles);
      }
  
      showSelectedBlockType(e) {
        const key = e.key || e.keyCode;
        if (
          e.type === "mouseup" ||
          (key === "Enter" ||
            key === this.keyCodes.ENTER ||
            key === "Backspace" ||
            key === this.keyCodes.BACKSPACE)
        ) {
          const selection = this.el.doc.getSelection().anchorNode.parentNode;
          const parentType = selection.parentNode.nodeName.toLowerCase();
          const type = selection.nodeName.toLowerCase();
          $all('.toolbar__btn[data-format="block"]', this.el.toolbar).forEach(
            btn => {
              if (btn.dataset.type === type || btn.dataset.type === parentType) {
                btn.classList.add("is-selected");
              } else {
                btn.classList.remove("is-selected");
              }
            }
          );
        }
      }
  
      showSelectedInlineStyles(e) {
        const selection = this.el.doc.getSelection();
        const type = selection.anchorNode.parentNode.tagName.toLowerCase();
        if (type === "body") return;
        this.settings.inlineActionKeys.forEach(key => {
          const command = this.settings.actions[key].command;
          const btn = $(`.toolbar__btn[data-command="${command}"]`);
          if (this.el.doc.queryCommandState(command)) {
            btn.classList.add("is-selected");
          } else {
            btn.classList.remove("is-selected");
          }
        });
      }
  
      getCurrentBlock() {
        const selection = this.el.doc.getSelection().anchorNode.parentNode;
        const type = selection.nodeName.toLowerCase();
        if (type === "body" || type === "html") return;
        const children = this.el.doc.body.childNodes;
        let index = 0;
        for (let i = 0; i < children.length; i++) {
          if (children[i] == selection) {
            index = i;
            break;
          }
        }
        const currentBlock = {
          index,
          type,
          text: selection.textContent
        };
        console.log(currentBlock);
        return currentBlock;
      }
  
      setState(newState) {
        this.state = {
          ...this.state,
          ...newState
        };
      }
  
      selectTool(e) {
        const target = e.target;
        if (!target.matches(".toolbar__btn")) return;
        const command = target.dataset.command;
        const format = target.dataset.format;
        const type = target.dataset.type;
        const value = target.value;
        const removeFormat = this.el.doc.queryCommandState(command);
        target.classList.toggle("is-selected");
  
        switch (format) {
          case "inline":
            if (command === "createLink") {
              // TODO: check if string is URL. If it is, transform it into link. If not, mount link form
              this.mountFormInsertLink();
            } else {
              this.editText(command, value);
            }
            break;
          case "block":
            if (removeFormat) {
              const selection = this.el.doc.getSelection();
              if (selection && selection.rangeCount) {
                const container = selection.getRangeAt(0).commonAncestorContainer;
                this.unwrap(container, this.settings.defParagraphSeparator);
              }
            } else {
              $all('.toolbar__btn[data-format="block"]', this.el.toolbar).forEach(
                btn => {
                  if (btn.dataset.type === type) {
                    btn.classList.add("is-selected");
                  } else {
                    btn.classList.remove("is-selected");
                  }
                }
              );
              this.editText(command, value);
              this.setState({ selectedBlockType: type });
              const selection = this.el.doc.getSelection();
              if (selection && selection.rangeCount) {
                const ancestor = selection.getRangeAt(0).commonAncestorContainer;
                const block =
                  ancestor.nodeType !== 3
                    ? ancestor.closest(`${type}`)
                    : ancestor.parentNode.closest(`${type}`);
                if (block.parentNode !== this.el.doc.body) {
                  this.unwrap(block.parentNode);
                }
              }
            }
            break;
        }
      }
  
      mountFormInsertLink() {
        const form = this.el.formInsertLink || this.renderFormInsertLink();
        const selection = this.el.doc.getSelection();
        if (selection && selection.rangeCount) {
          console.log(selection);
          const span = document.createElement("span");
          const range = selection.getRangeAt(0);
          range.surroundContents(span);
          form.style.top = span.offsetTop + this.el.iframe.offsetTop - 56 + "px";
          form.style.left = span.offsetLeft + 16 + "px";
          form.classList.remove("is-hidden");
          this.el.doc.body.focus();
        }
      }
  
      unwrap(container, newChildType = null) {
        const parent = container.parentNode;
  
        while (container.firstChild) {
          if (newChildType) {
            container.replaceChild(
              createElement(newChildType, null, container.firstChild.textContent),
              container.firstChild
            );
          }
          parent.insertBefore(container.firstChild, container);
        }
        parent.removeChild(container);
        this.displayHTML();
      }
  
      // TODO: add url form
      editText(command, val = "") {
        const isChanged = this.el.doc.execCommand(command, false, val);
        if (isChanged) {
          this.displayHTML();
        }
        this.el.doc.body.focus();
      }
  
      renderEditor() {
        const editor = createElement("iframe", {
          id: this.settings.id,
          name: this.settings.id,
          className: "rich-editor",
          src: "about:blank",
          target: "_parent",
          title: "rich-text-editor"
        });
        $(this.settings.parentSelector).appendChild(editor);
        return editor;
      }

  
      renderFormInsertLink() {
        const btnClose = createElement(
          "button",
          {
            className: "toolbar__form-btn",
            type: "button"
          },
          createElement("box-icon", {
            className: "box-icon",
            name: "x"
          })
        );
        const input = createElement("input", {
          className: "toolbar__submit",
          type: "submit",
          name: "url",
          value: "Insert Link"
        });
        const form = createElement(
          "form",
          {
            className: "toolbar__form--inline toolbar__form--link is-hidden",
            name: "insertLink"
          },
          createElement("input", {
            className: "toolbar__input toolbar__input--link",
            type: "text",
            name: "url",
            id: "url",
            placeholder: "Enter URL..."
          }),
          input,
          btnClose
        );
        btnClose.addEventListener("click", e => {
          form.classList.add("is-hidden");
          if (input.value !== "") {
          }
        });
        input.addEventListener("blur", e => {
          let url = e.currentTarget.value;
          if (!/^http:\/\//.test(url)) {
            url = "http://" + url;
          }
          e.currentTarget.value = url;
        });
        form.addEventListener("submit", e => {
          e.preventDefault();
          console.log("submit");
          const input = $(".toolbar__input--link", e.currentTarget);
          let url = input.value;
          if (!/^http:\/\//.test(url)) {
            url = "http://" + url;
          }
          console.log(url);
          e.currentTarget.classList.add("is-hidden");
          e.currentTarget.reset();
          this.editText("createLink", url);
          const selection = this.el.doc.getSelection();
          console.log(selection.anchorNode.parentNode);
          this.unwrap(selection.anchorNode.parentNode.closest("span"));
        });
        this.el = {
          ...this.el,
          formInsertLink: form
        };
        this.el.parent.appendChild(form);
        return form;
      }
    }
  
    return RichEditor;
  })();
  
  const editor = new editor_plugin({
    id: "richEditor",
    parentSelector: ".container"
  });
  