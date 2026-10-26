export class ReportStack {
  constructor() {
    this.items = [];
  }

  push(report) {
    this.items = this.items.filter(
      (item) => item._id !== report._id
    );

    this.items.push(report);
  }

  pop() {
    return this.items.pop() || null;
  }

  peek() {
    return this.items.length
      ? this.items[this.items.length - 1]
      : null;
  }

  getAll() {
    return [...this.items].reverse();
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }
}