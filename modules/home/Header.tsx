
const Header = () => {
    return (
        <>
            <h2 className="mb-1 text-xl font-semibold">URL Batch Checker</h2>
            <p className="mb-5 text-muted-foreground">
                Paste URLs or upload a CSV — one URL per line.
                Refresh-safe: batch state is saved in the URL and restored from the API.
            </p>
        </>
    );
};

export default Header;
