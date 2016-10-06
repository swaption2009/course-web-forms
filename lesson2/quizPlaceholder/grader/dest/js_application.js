var Grader = (function() {
  // elem refers to css selector

  // http://stackoverflow.com/questions/1068834/object-comparison-in-javascript?lq=1
  function deepCompare () {
    var i, l, leftChain, rightChain;

    function compare2Objects (x, y) {
      var p;

      // remember that NaN === NaN returns false
      // and isNaN(undefined) returns true
      if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
        return true;
      }

      // Compare primitives and functions.     
      // Check if both arguments link to the same object.
      // Especially useful on step when comparing prototypes
      if (x === y) {
        return true;
      }

      // Works in case when functions are created in constructor.
      // Comparing dates is a common scenario. Another built-ins?
      // We can even handle functions passed across iframes
      if ((typeof x === 'function' && typeof y === 'function') ||
        (x instanceof Date && y instanceof Date) ||
        (x instanceof RegExp && y instanceof RegExp) ||
        (x instanceof String && y instanceof String) ||
        (x instanceof Number && y instanceof Number)) {
          return x.toString() === y.toString();
      }

      // At last checking prototypes as good a we can
      if (!(x instanceof Object && y instanceof Object)) {
        return false;
      }

      if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
        return false;
      }

      if (x.constructor !== y.constructor) {
        return false;
      }

      if (x.prototype !== y.prototype) {
        return false;
      }

      // Check for infinitive linking loops
      if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
         return false;
      }

      // Quick checking of one object beeing a subset of another.
      // todo: cache the structure of arguments[0] for performance
      for (p in y) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
          return false;
        }
        else if (typeof y[p] !== typeof x[p]) {
          return false;
        }
      }

      for (p in x) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
          return false;
        }
        else if (typeof y[p] !== typeof x[p]) {
          return false;
        }

        switch (typeof (x[p])) {
          case 'object':
          case 'function':
            leftChain.push(x);
            rightChain.push(y);

            if (!compare2Objects (x[p], y[p])) {
              return false;
            }

            leftChain.pop();
            rightChain.pop();
            break;

          default:
            if (x[p] !== y[p]) {
              return false;
            }
            break;
        }
      }

      return true;
    }

    if (arguments.length < 1) {
      return true; //Die silently? Don't know how to handle such case, please help...
      // throw "Need two or more arguments to compare";
    }

    for (i = 1, l = arguments.length; i < l; i++) {

      leftChain = []; //Todo: this can be cached
      rightChain = [];

      if (!compare2Objects(arguments[0], arguments[i])) {
        return false;
      }
    }
    return true;
  }

  function Queue(grader) {
    this.grader = grader;
    this.gradingSteps = [];
    this.flushing = false;
    this.alwaysGo = false;
  };

  Queue.prototype = {
    add: function(callback, messages, keepGoing) {
      if (keepGoing !== false) {
        keepGoing = true;
      }

      if (!callback) {
        throw new Error("UD: Every test added to the queue must have a valid function.");
      }

      this.gradingSteps.push({
        callback: callback,
        isCorrect: false,
        wrongMessage: messages.wrongMessage || null,
        comment: messages.comment || null,
        category: messages.category || null,
        keepGoing: keepGoing
      });
    },

    flush: function() {    
      if (!this.flushing) {
        this.flushing = true;
      }
      this.step();
    },

    clear: function() {
      this.flushing = false;
      this.gradingSteps = [];
    },

    step: function() {
      if (this.gradingSteps.length === 0) {
        this.clear();
      }

      if (this.flushing) {
        var test = this.gradingSteps.shift();
        
        try {
          test.isCorrect = test.callback();
        } catch (e) {
          console.log(e);
          test.isCorrect = false;
        }

        if (!test.isCorrect) {
          // console.log(test.wrongMessage + " " + test.isCorrect);
        }

        this.registerResults(test);

        if (test.isCorrect || test.keepGoing || this.alwaysGo) {
          this.step();
        } else {
          this.clear();
        }
      }
    },

    registerResults: function (test) {
      this.grader.registerResults(test);
    }
  };

  function Grader (categoryMessages) {
    var self = this;

    this.specificFeedback = [];
    this.comments = [];
    this.isCorrect = false;
    this.correctHasChanged = false;
    this.queue = new Queue(self);
    this.categoryMessages = categoryMessages || null;
    this.generalFeedback = [];
  };

  Grader.prototype = {
    addTest: function (callback, messages, keepGoing) {
      this.queue.add(callback, messages, keepGoing);
    },

    runTests: function (options) {
      if (options) {
        this.queue.alwaysGo = options.ignoreCheckpoints || false;
      }
      this.queue.flush();
    },

    registerResults: function (test) { 
      this.generateSpecificFeedback(test);
      this.generateGeneralFeedback(test);
      this.setCorrect(test);
    },

    // TODO: CHECK ALL OF THIS LOGIC!
    generateSpecificFeedback: function (test) {
      if (!test.isCorrect && test.wrongMessage) {
        this.addSpecificFeedback(test.wrongMessage);
      } else if (test.isCorrect && test.comment) {
        this.addComment(test.comment)
      }
    },

    generateGeneralFeedback: function (test) {
      if (!test.isCorrect && test.category) {
        if (this.generalFeedback.indexOf(this.categoryMessages[test.category]) === -1) {
          this.generalFeedback.push(this.categoryMessages[test.category]);
        }  
      }
    },

    setCorrect: function (test) {
      if (this.correctHasChanged) {
        this.isCorrect = this.isCorrect && test.isCorrect;
      } else {
        this.correctHasChanged = true;
        this.isCorrect = test.isCorrect;
      }
    },

    addSpecificFeedback: function (feedback) {
      this.specificFeedback.push(feedback);
    },

    addComment: function (feedback) {
      this.comments.push(feedback);
    },

    getFormattedWrongMessages: function (separator) {
      var allMessages, message;
      
      allMessages = this.specificFeedback.concat(this.generalFeedback);
      message = allMessages.join(separator);

      return message;
    },

    getFormattedComments: function (separator) {
      return this.comments.join(separator);
    },

    isType: function (theirValue, expectedType, showDefaultWrongMessage) {
      showDefaultWrongMessage = showDefaultWrongMessage || false;
      var isCorrect = false;

      if (typeof theirValue !== expectedType) {
        
        if (typeof theirValue === 'function') {
          theirValue = theirValue.name;
        };

        isCorrect = false;
      } else if (typeof theirValue === expectedType){
        isCorrect = true;
      }
      return isCorrect;
    },

    isInstance: function (theirValue, expectedInstance, showDefaultWrongMessage) {
      showDefaultWrongMessage = showDefaultWrongMessage || false;
      var isCorrect = false;

      if (theirValue instanceof expectedInstance !== true) {

        isCorrect = false;
      } else if (theirValue instanceof expectedInstance === true){
        isCorrect = true;
      }
      return isCorrect;
    },

    isValue: function (theirValue, expectedValue, showDefaultWrongMessage) {
      showDefaultWrongMessage = showDefaultWrongMessage || false;
      var isCorrect = false;

      if (!deepCompare(theirValue, expectedValue)) {
        isCorrect = false;
      } else if (deepCompare(theirValue, expectedValue)) {
        isCorrect = true;
      }
      return isCorrect;
    },

    isInRange: function (theirValue, lower, upper, showDefaultWrongMessage) {
      showDefaultWrongMessage = showDefaultWrongMessage || false;
      var isCorrect = false;

      if (typeof theirValue !== 'number' || isNaN(theirValue)) {
        isCorrect = false
      } else if (theirValue > upper || theirValue < lower) {
        isCorrect = false;

      } else if (theirValue < upper || theirValue > lower) {
        isCorrect = true;
      }
      return isCorrect;
    },

    // TODO: does this ever actually fail? or does it just error?
    isSet: function (value, showDefaultWrongMessage) {
      showDefaultWrongMessage = showDefaultWrongMessage || false;
      var isCorrect = false;

      if (value === undefined) {
        isCorrect = false;

      } else {
        isCorrect = true;
      }
      return isCorrect;
    },

    isjQuery: function (elem) {
      // could use obj.jquery, which will only return true if it is a jquery object
      if (elem instanceof $) return true;
      return false;
    },

    hasCorrectTag: function (elem, tag) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.is(tag)) return true;
      return false;
    },

    hasCorrectClass: function (elem, className) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.hasClass(className)) return true;
      return false;
    },

    hasCorrectId: function (elem, id) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.is('#' + id)) return true;
      return false;
    },

    hasCorrectText: function (elem, text) {
      // TODO: modify to point out specific changes?
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.text() === text) return true;
      return false;
    },

    hasAttr: function (elem, attrName, correctAttr) {
      var isCorrect = false;
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (correctAttr && elem.attr(attrName) === correctAttr) {
        isCorrect = true;
      } else if (!correctAttr && elem.attr(attrName)) {
        isCorrect = true;
      }
      return isCorrect;
    },

    hasCorrectLength: function (elems, _length) {
      if (!this.isjQuery(elems)) {
        elems = $(elems);
      }
      var cLength = elems.length;
      if (cLength === _length) return true;
      return false;
    },

    isCorrectElem: function (elem, correctElem) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.is(correctElem)) return true;
      return false;
    },

    isCorrectCollection: function (collection, correctCollection) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (collection.is(correctCollection)) return true;
      return false;
    },

    hasCorrectStyle: function (elem, _style, _correctStyle) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      var currentStyle = elem.css(_style);
      if (currentStyle  === _correctStyle) return true;
      return false;
    },

    hasCalledFunction: function (func) {
      var hasCalledFunction = false;
      $("script:contains(." + func + ")").each(function() {
        if ($(this).text().search("For this quiz") !== -1 && $(this).text().search("returns true if") === -1) hasCalledFunction = true;
      });
      return hasCalledFunction;
    },

    doesExistInParent: function (elem, parentElem) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (!this.isjQuery(parentElem)) {
        parentElem = $(parentElem);
      }
      if (parentElem.find(elem).length > 0) return true;
      return false;
    },

    doesNotExistInParent: function (elem, parentElem) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (!this.isjQuery(parentElem)) {
        parentElem = $(parentElem);
      }
      if (parentElem.find(elem).length === 0) return true;
      return false;
    },

    doesExist: function (elem) {
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.length > 0) return true;
      return false;
    },

    areSiblings: function (elem1, elem2) {
      if (!this.isjQuery(elem1)) {
        elem1 = $(elem1);
      }
      if (!this.isjQuery(elem2)) {
        elem2 = $(elem2);
      }
      if (elem1.siblings(elem2).length > 0) return true;
      return false;
    },

    /**
     * Determine if an elem is an immediate child of a parent.
     * @param  {String}  elem       CSS selector
     * @param  {[type]}  parentElem CSS selector or $
     */
    isImmediateChild: function (elem, parentElem) {
      var isCorrect = false;
      if (this.isjQuery(elem)) {
        throw new Error("elem needs to be a string for Grader.isImmediateChild()");
      }
      if (!this.isjQuery(parentElem)) {
        parentElem = $(parentElem);
      }
      if (parentElem.children(elem).length > 0) {
        isCorrect = true;
      }
      return isCorrect;
    },

    hasParent: function (elem, parentElem) {
      var isCorrect = false;
      if (this.isjQuery(parentElem)) {
        throw new Error("parentElem needs to be a string for Grader.hasParent()");
      }
      if (!this.isjQuery(elem)) {
        elem = $(elem);
      }
      if (elem.closest(parentElem).length > 0) {
        isCorrect = true;
      }
      return isCorrect;
    }
  }

  function sendResultsToExecutor() {
    var output = {
      isCorrect: false,
      test_feedback: "",
      test_comments: "",
      congrats: ""
    }
    for (arg in arguments) {
      var thisIsCorrect = arguments[arg].isCorrect;
      var thisTestFeedback = arguments[arg].getFormattedWrongMessages();
      var thisTestComment = arguments[arg].getFormattedComments();
      if (typeof thisIsCorrect !== 'boolean') {
        thisIsCorrect = false;
      }

      switch (arg) {
        case '0':
          output.congrats = arguments[arg];
        case '1':
          output.isCorrect = thisIsCorrect;
          output.test_feedback = thisTestFeedback;
          output.test_comments = thisTestComment;
          break;
        default:
          output.isCorrect = thisIsCorrect && output.isCorrect;
          if (output.test_feedback !== "") {
            output.test_feedback = [output.test_feedback, thisTestFeedback].join('\n');
          } else {
            output.test_feedback = thisTestFeedback;
          }
          
          if (output.test_comments !== "") {
            output.test_comments = [output.test_comments, thisTestFeedback].join('\n');
          } else {
            output.test_comments = thisTestComment;
          }
          break;
      }
    }
    output = JSON.stringify(output);
    console.info("UDACITY_RESULT:" + output);
  }
  return Grader;
})();
function performSubmission() {
	var grader = new Grader({
		// can add shared messages here
	});

	grader.addTest(function() {
		return grader.hasCorrectLength('label', 1);
	}, {
	  wrongMessage: "There should be one <label>."
	});

	grader.addTest(function() {
		return grader.hasCorrectLength('input', 1);
	}, {
	  wrongMessage: "There should be one <input>."
	}, false);

	grader.addTest(function() {
		return grader.hasCorrectLength('input[type="text"]', 1);
	}, {
	  wrongMessage: "The <input> should have type=\"text\"."
	}, false);

	grader.addTest(function() {
		var isCorrect = false;
		var input = $('input');
		var id = input.attr('id');
		
		var hasOneLabel = grader.hasCorrectLength('label[for="' + id + '"]', 1) || grader.hasParent(input, 'label');
		isCorrect = hasOneLabel;

	  return isCorrect;
	}, {
	  wrongMessage: "The <input> needs to be paired with a single <label>."
	});

	grader.addTest(function() {
		return grader.hasAttr('input', 'placeholder', 'Event Name');
	}, {
		wrongMessage: "The input should have a placeholder set to 'Event Name'."
	});

	grader.runTests(
		// {ignoreCheckpoints: true}
	);

	result = {
	  is_correct: grader.isCorrect,
	  test_feedback: grader.getFormattedWrongMessages('\n'),
	  test_comments: grader.getFormattedComments('\n'),
	  congrats: "The placeholder is looking good! Good job!"
	};
	return result;
}