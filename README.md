# node-sonos

Node.js Interface to [Sonos](http://sonos.com)

# IMPORTANT NOTE - TYPESCRIPT FORK

This is a fork of [bencevans/node-sonos](https://github.com/bencevans/node-sonos) that @jabooth undertook for fun in Dec 2016. I moved `node-sonos` and a handful of other projects to Typescript and placed them under a new namespace at [github/homeaudio](https://github.com/homeaudio/) in an effort to better understand and rapidly improve all these interrelated projects.

For now I'm maintaining my forks at [github/homeaudio](https://github.com/homeaudio/), but I would be delighted if these forks were re-unified with their original projects at some point. Given the extensive nature of the changes made though, I understand that this may be challenging for the original authors.


## API

This fork of `node-sonos` moves to a promise-based API. If you are familiar with @bencevans original `node-sonos` client, expect to change calls of the form:

```js
const sonos = new Sonos()
sonos.play(callback)
```
to

```typescript
const sonos = new Sonos()
sonos.play().then(callback)
...
```

If you are working in Typescript, Babel, or future JS runtimes, you can adopt async/await:

```js
async function main() {
    const sonos = new Sonos()
    const result = await sonos.play()
    ...
}

main()
```
As this fork is re-written in Typescript, the API is typed. This typing information will be used to generate API docs in the future.

For now do note that I have changed the API in a number of places to try and make things more consistent and simple. In general:

1. I've removed many cases where it was permitted to pass in either an object/function/string as the `i`'th parameter of a function. This led to a lot of pretty grim introspection at the top of methods to figure out the callee's intent, and made typing the API much more confusing than it needed to be. Now, the only positional arguments taken are those that have to be supplied - further optional arguments are provided in options objects with well-defined shape.
2. I've tried to leave JSdocs where the comment is still helpful and relevent. I've removed typing information from here (DRI).
3. I've adapted ES2015 style classes, which I personally find much more legible.

There's lots of other changes, but I'll have to come back and state then clearly against what is currently on master if there is further interest in this fork.

## Examples

Additional examples can be found in the [/examples](https://github.com/homeaudio/node-sonos/tree/master/examples) directory within the repository.

## Installation

*Via npm*

    npm install @homeaudio/sonos

*Via Git*

    npm install git://github.com/homeaudio/node-sonos.git

## Maintainers

* Ben Evans (@bencevans)
* Stephen Wan (@stephen)
* Marshall T. Rose (@mrose17)
* James Booth (@jabooth)

And a big thanks to all you other [contributors](https://github.com/bencevans/node-sonos/graphs/contributors)! Pull-requests are beautiful things.

## Licence

(MIT Licence)

    Copyright (c) 2012 Ben Evans

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
