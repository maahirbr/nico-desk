// FIND is one field. A plain GET form to /search.
export function FindField() {
  return (
    <form action="/search" method="get" role="search" className="alt-field">
      <label className="sr-only" htmlFor="find-q">
        Find
      </label>
      <input id="find-q" name="q" type="search" placeholder="Find" autoComplete="off" className="caps" />
    </form>
  );
}
