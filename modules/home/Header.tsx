
const Header = () => {
    return (<>
        <h2 style={{ marginBottom: 4 }}>URL Batch Checker</h2>
        <p style={{ color: "#666", marginBottom: 20 }}>
            Paste URLs or upload a CSV — one URL per line.
            Refresh-safe: batch state is saved in the URL and restored from the API.
        </p>
    </>

    )
}

export default Header